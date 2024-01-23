import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	redirect,
	type MetaFunction,
	type ActionFunctionArgs,
} from '@remix-run/node'
import { Form, Link, useActionData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary'
import { CheckboxField, ErrorList, Field } from '~/components/forms'
import { Spacer } from '~/components/spacer'
import { StatusButton } from '~/components/ui/status-button'
import { bcrypt, getSessionExpirationDate } from '~/utils/auth.server'
import { validateCSRF } from '~/utils/csrf.server'
import { prisma } from '~/utils/db.server'
import { checkHoneypot } from '~/utils/honeypot.server'
import { useIsPending } from '~/utils/misc'
import { sessionStorage } from '~/utils/session.server'
import { PasswordSchema, UsernameSchema } from '~/utils/user-validation'

const LoginFormSchema = z.object({
	username: UsernameSchema,
	password: PasswordSchema,
	remember: z.boolean().optional(),
})

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	checkHoneypot(formData)
	const submission = await parse(formData, {
		schema: intent =>
			LoginFormSchema.transform(async (data, ctx) => {
				if (intent !== 'submit') return { ...data, user: null }
				// find the user in the database by their username

				const userWithPassword = await prisma.user.findUnique({
					// include the password hash in this select
					select: { id: true, password: { select: { hash: true } } },
					where: { username: data.username },
				})
				// if there's no user by that username then add an issue to the context
				// and return z.NEVER
				// https://zod.dev/?id=validating-during-transform
				if (!userWithPassword || !userWithPassword.password) {
					ctx.addIssue({
						code: 'custom',
						message: 'Invalid username or password',
					})
					return z.NEVER
				}
				// use bcrypt.compare to compare the provided password with the hash
				const isValid = await bcrypt.compare(
					data.password,
					userWithPassword.password.hash,
				)

				// if not valid, then create same error as above and return z.NEVER
				if (!isValid) {
					ctx.addIssue({
						code: 'custom',
						message: 'Invalid username or password',
					})
					return z.NEVER
				}
				// don't return the password hash here, just make a user with an id
				return { ...data, user: { id: userWithPassword.id } }
			}),
		async: true,
	})

	// get the password off the payload that's sent back
	delete submission.payload.password

	if (submission.intent !== 'submit') {
		// @ts-expect-error - conform should probably have support for doing this
		delete submission.value?.password
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value?.user) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	// get the user from the submission.value
	const { user, remember } = submission.value

	// request's cookie header request.headers.get('cookie')
	// use the getSession utility to get the session value from the
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)

	// set the 'userId' in the session to the user.id
	cookieSession.set('userId', user.id)

	// update this redirect to add a 'set-cookie' header to the result of
	// commitSession with the session value you're working with
	return redirect('/', {
		headers: {
			// add an expires option to this commitSession call and set it to
			// a date 30 days in the future if they checked the remember checkbox
			// or undefined if they did not.
			'set-cookie': await sessionStorage.commitSession(cookieSession, {
				expires: remember ? getSessionExpirationDate() : undefined,
			}),
		},
	})

	return redirect('/')
}

export default function LoginPage() {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'login-form',
		constraint: getFieldsetConstraint(LoginFormSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: LoginFormSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="flex min-h-full flex-col justify-center pb-32 pt-20">
			<div className="mx-auto w-full max-w-md">
				<div className="flex flex-col gap-3 text-center">
					<h1 className="text-h1">Welcome back!</h1>
					<p className="text-body-md text-muted-foreground">
						Please enter your details.
					</p>
				</div>
				<Spacer size="xs" />

				<div>
					<div className="mx-auto w-full max-w-md px-8">
						<Form method="POST" {...form.props}>
							<AuthenticityTokenInput />
							<HoneypotInputs />
							<Field
								labelProps={{ children: 'Username' }}
								inputProps={{
									...conform.input(fields.username),
									autoFocus: true,
									className: 'lowercase',
								}}
								errors={fields.username.errors}
							/>

							<Field
								labelProps={{ children: 'Password' }}
								inputProps={conform.input(fields.password, {
									type: 'password',
								})}
								errors={fields.password.errors}
							/>

							<div className="flex justify-between">
								<CheckboxField
									labelProps={{
										htmlFor: fields.remember.id,
										children: 'Remember me',
									}}
									buttonProps={conform.input(fields.remember, {
										type: 'checkbox',
									})}
									errors={fields.remember.errors}
								/>
								<div>
									<Link
										to="/forgot-password"
										className="text-body-xs font-semibold"
									>
										Forgot password?
									</Link>
								</div>
							</div>

							<ErrorList errors={form.errors} id={form.errorId} />

							<div className="flex items-center justify-between gap-6 pt-3">
								<StatusButton
									className="w-full"
									status={isPending ? 'pending' : actionData?.status ?? 'idle'}
									type="submit"
									disabled={isPending}
								>
									Log in
								</StatusButton>
							</div>
						</Form>
						<div className="flex items-center justify-center gap-2 pt-6">
							<span className="text-muted-foreground">New here?</span>
							<Link to="/signup">Create an account</Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Login to Epic Notes' }]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
