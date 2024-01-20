import {
	type LoaderFunctionArgs,
	json,
	redirect,
	type ActionFunctionArgs,
	type MetaFunction,
} from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { GeneralErrorBoundary } from '~/components/error-boundary'
import { floatingToolbarClassName } from '~/components/floating-toolbar'
import { Button } from '~/components/ui/button'
import { validateCSRF } from '~/utils/csrf.server'
import { prisma } from '~/utils/db.server'
import { getNoteImgSrc, invariantResponse } from '~/utils/misc'
import { type loader as notesLoader } from './notes'

export async function loader({ params }: LoaderFunctionArgs) {
	const note = await prisma.note.findFirst({
		select: {
			title: true,
			content: true,
			images: {
				select: { id: true, altText: true },
			},
		},
		where: { id: params.noteId },
	})

	invariantResponse(note, 'Note not found', { status: 404 })

	return json({ note })
}

export async function action({ params, request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const intent = formData.get('intent')

	invariantResponse(intent === 'delete', 'Invalid intent')

	await validateCSRF(formData, request.headers)

	await prisma.note.delete({ where: { id: params.noteId } })
	return redirect(`/users/${params.username}/notes`)
}

export default function NoteRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">{data.note?.title}</h2>
			<div className="overflow-y-auto pb-24">
				<ul className="flex flex-wrap gap-5 py-5">
					{data.note.images.map(image => (
						<li key={image.id}>
							<a href={getNoteImgSrc(image.id)}>
								<img
									src={getNoteImgSrc(image.id)}
									alt={image.altText ?? ''}
									className="h-32 w-32 rounded-lg object-cover"
								/>
							</a>
						</li>
					))}
				</ul>
				<p className="whitespace-break-spaces text-sm md:text-lg">
					{data.note?.content}
				</p>
			</div>
			<div className={floatingToolbarClassName}>
				<Form method="POST">
					<AuthenticityTokenInput />
					<Button
						name="intent"
						value="delete"
						type="submit"
						variant="destructive"
					>
						Delete
					</Button>
				</Form>
				<Button asChild>
					<Link to="edit">Edit</Link>
				</Button>
			</div>
		</div>
	)
}

export const meta: MetaFunction<
	typeof loader,
	{ 'routes/users+/$username_+/notes': typeof notesLoader }
> = ({ data, params, matches }) => {
	// use matches to find the route for notes by that ID
	// matches.find(m => m.id === 'routes/users+/$username_+/notes')

	// use the data from our loader and our parent's loader to create a title
	// and description that show the note title, user's name, and the first part of
	// the note's content.
	const notesMatch = matches.find(
		m => m.id === 'routes/users+/$username_+/notes',
	)
	const displayName = notesMatch?.data?.owner.name ?? params.username

	const noteTitle = data?.note.title ?? 'Note'
	const noteContentsSummary =
		data && data.note.content.length > 100
			? data?.note.content.slice(0, 97) + '...'
			: data?.note.content
	return [
		{ title: `${noteTitle} | ${displayName}'s Notes | Epic Notes` },
		{
			name: 'description',
			content: noteContentsSummary,
		},
	]
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
