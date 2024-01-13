import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { Label } from '@radix-ui/react-label'
import {
	json,
	redirect,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	unstable_parseMultipartFormData as parseMultipartFormData,
} from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary'
import { floatingToolbarClassName } from '~/components/floating-toolbar'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { StatusButton } from '~/components/ui/status-button'
import { Textarea } from '~/components/ui/textarea'
import { db, updateNote } from '~/utils/db.server'
import { cn, invariantResponse, useIsSubmitting } from '~/utils/misc'

const titleMaxLength = 100
const contentMaxLength = 10000
const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const NoteEditorSchema = z.object({
	// We can optionally add an error message to zod
	title: z
		.string()
		.min(1, { message: 'title is required' })
		.max(titleMaxLength),
	content: z.string().min(1).max(contentMaxLength),
})

export async function action({ request, params }: ActionFunctionArgs) {
	invariantResponse(params.noteId, 'noteId param is required')

	// switch this for parseMultipartFormData and createMemoryUploadHandler
	// set the `maxPartSize` setting to 3MB () 1024 * 1024 * 3) to prevent
	// users from uploading files that are too large.
	// const formData = await request.formData()
	const formData = await parseMultipartFormData(
		request,
		createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
	)

	const submission = parse(formData, {
		schema: NoteEditorSchema,
	})

	if (!submission.value) {
		// Send the submitted data back in case of error
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const { title, content } = submission.value

	await updateNote({
		id: params.noteId,
		title,
		content,
		images: [
			{
				id: formData.get('imageId') ?? '',
				file: formData.get('file') ?? null,
				altText: formData.get('altText') ?? null,
			},
		],
		// add an images array and pass an object that has the
		// id, file, and altText that was submitted.
		// Right now, we're just going to grab these values straight from formData.
		// formData.get('file'), etc.
		// In the next step, we'll add this to the Zod schema.
		// TypeScript won't like this. We'll fix it in the next step, so don't worry about it.
	})

	return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

export async function loader({ params }: LoaderFunctionArgs) {
	const note = db.note.findFirst({
		where: {
			id: {
				equals: params.noteId,
			},
		},
	})

	invariantResponse(note, 'Note not found', { status: 404 })

	return json({
		note: {
			title: note.title,
			content: note.content,
			images: note.images.map(i => ({ id: i.id, altText: i.altText })),
		},
	})
}

export default function NoteEdit() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	// determine whether this form is submitting
	const isSubmitting = useIsSubmitting()

	const [form, fields] = useForm({
		// we can use useId hook to get the id
		id: 'note-editor',
		constraint: getFieldsetConstraint(NoteEditorSchema),
		lastSubmission: actionData?.submission,
		// Conform enables validation of formData
		// on the client without n/w request.
		onValidate({ formData }) {
			return parse(formData, { schema: NoteEditorSchema })
		},
		defaultValue: {
			title: data.note.title,
			content: data.note.content,
		},
	})

	return (
		<div className="absolute inset-0">
			<Form
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				{...form.props}
				encType="multipart/form-data"
			>
				<div className="flex flex-col gap-1">
					<div>
						<Label htmlFor="note-title">Title</Label>
						<Input autoFocus {...conform.input(fields.title)} />
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.title.errorId}
								errors={fields.title.errors}
							/>
						</div>
					</div>
					<div>
						<Label htmlFor={fields.content.id}>Content</Label>
						<Textarea {...conform.textarea(fields.content)} />
						<div className="min-h-[32px] px-4 pb-3 pt-1">
							<ErrorList
								id={fields.content.errorId}
								errors={fields.content.errors}
							/>
						</div>
					</div>
					<div>
						<Label>Image</Label>
						<ImageChooser image={data.note.images[0]} />
					</div>
				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<Button form={form.id} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton
					form={form.id}
					type="submit"
					disabled={isSubmitting}
					status={isSubmitting ? 'pending' : 'idle'}
				>
					Submit
				</StatusButton>
			</div>
		</div>
	)
}

function ErrorList({
	errors,
	id,
}: {
	errors?: Array<string> | null
	id?: string
}) {
	return errors?.length ? (
		<ul className="flex flex-col gap-1" id={id}>
			{errors.map((error, i) => (
				<li key={i} className="text-[10px] text-foreground-destructive">
					{error}
				</li>
			))}
		</ul>
	) : null
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => (
					<p>No note with the id "{params.noteId}" exists</p>
				),
			}}
		/>
	)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ImageChooser({
	image,
}: {
	image?: { id: string; altText?: string | null }
}) {
	const existingImage = Boolean(image)
	const [previewImage, setPreviewImage] = useState<string | null>(
		existingImage ? `/resources/images/${image?.id}` : null,
	)
	const [altText, setAltText] = useState(image?.altText ?? '')

	return (
		<fieldset>
			<div className="flex gap-3">
				<div className="w-32">
					<div className="relative h-32 w-32">
						<label
							htmlFor="image-input"
							className={cn('group absolute h-32 w-32 rounded-lg', {
								'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
									!previewImage,
								'cursor-pointer focus-within:ring-4': !existingImage,
							})}
						>
							{previewImage ? (
								<div className="relative">
									<img
										src={previewImage}
										alt={altText ?? ''}
										className="h-32 w-32 rounded-lg object-cover"
									/>
									{existingImage ? null : (
										<div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
											new
										</div>
									)}
								</div>
							) : (
								<div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
									➕
								</div>
							)}
							{/* if there's an existing image, add a hidden input with a name "imageId" with the value of image's id */}
							{existingImage ? (
								<input name="imageId" type="hidden" value={image?.id} />
							) : null}
							<input
								id="image-input"
								aria-label="Image"
								className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
								onChange={event => {
									const file = event.target.files?.[0]

									if (file) {
										const reader = new FileReader()
										reader.onloadend = () => {
											setPreviewImage(reader.result as string)
										}
										reader.readAsDataURL(file)
									} else {
										setPreviewImage(null)
									}
								}}
								// add a name of "file" here:
								name="file"
								type="file"
								// add accept="image/*" here so users only upload images
								accept="image/*"
							/>
						</label>
					</div>
				</div>
				<div className="flex-1">
					<Label htmlFor="alt-text">Alt Text</Label>
					<Textarea
						id="alt-text"
						// add a name of "altText" here
						name="altText"
						defaultValue={altText}
						onChange={e => setAltText(e.currentTarget.value)}
					/>
				</div>
			</div>
		</fieldset>
	)
}
