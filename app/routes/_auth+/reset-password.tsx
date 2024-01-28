import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
	json,
	type MetaFunction,
	type ActionFunctionArgs,
	redirect,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary'
import { ErrorList, Field } from '~/components/forms'
import { StatusButton } from '~/components/ui/status-button'
import { requireAnonymous, resetUserPassword } from '~/utils/auth.server'
import { prisma } from '~/utils/db.server'
import { invariant, useIsPending } from '~/utils/misc'
import { PasswordSchema } from '~/utils/user-validation'
import { verifySessionStorage } from '~/utils/verification.server'
import { type VerifyFunctionArgs } from './verify'

const resetPasswordUsernameSessionKey = 'resetPasswordUsername'

export async function handleVerification({
	request,
	submission,
}: VerifyFunctionArgs) {
	// the submission.value.target is the user's email or username. Use that to
	// find the user in the database.
	// You'll probably want to use OR to match either the email or username
	// https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#or
	// if the user doesn't exist, then set submission.error.code = 'Invalid code'
	// and return a json response with a 400 status code
	// otherwise, get the verifySession from the request and set the
	// user's username in the session
	// then redirect to the reset password page
	// don't forget to commit the session.
	invariant(submission.value, 'submission.value should be defined by now')
	const target = submission.value.target
	const user = await prisma.user.findFirst({
		where: { OR: [{ email: target }, { username: target }] },
		select: { email: true, username: true },
	})
	// we don't want to say the user is not found if the email is not found
	// because that would allow an attacker to check if an email is registered
	if (!user) {
		submission.error.code = ['Invalid code']
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	verifySession.set(resetPasswordUsernameSessionKey, user.username)
	return redirect('/reset-password', {
		headers: {
			'set-cookie': await verifySessionStorage.commitSession(verifySession),
		},
	})
}

const ResetPasswordSchema = z
	.object({
		password: PasswordSchema,
		confirmPassword: PasswordSchema,
	})
	.refine(({ confirmPassword, password }) => password === confirmPassword, {
		message: 'The passwords did not match',
		path: ['confirmPassword'],
	})

async function requireResetPasswordUsername(request: Request) {
	await requireAnonymous(request)
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const resetPasswordUsername = verifySession.get(
		resetPasswordUsernameSessionKey,
	)
	if (typeof resetPasswordUsername !== 'string' || !resetPasswordUsername) {
		throw redirect('/login')
	}
	return resetPasswordUsername
}

export async function loader({ request }: LoaderFunctionArgs) {
	const resetPasswordUsername = await requireResetPasswordUsername(request)
	return json({ resetPasswordUsername })
}

export async function action({ request }: ActionFunctionArgs) {
	const resetPasswordUsername = await requireResetPasswordUsername(request)
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: ResetPasswordSchema,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value?.password) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	// call the resetUserPassword utility here
	const { password } = submission.value

	// remove the resetPasswordUsernameSessionKey from the session
	// and redirect the user to login
	// don't forget to destroy the session
	await resetUserPassword({ username: resetPasswordUsername, password })
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	return redirect('/login', {
		headers: {
			'set-cookie': await verifySessionStorage.destroySession(verifySession),
		},
	})
}

export const meta: MetaFunction = () => {
	return [{ title: 'Reset Password | Epic Notes' }]
}

export default function ResetPasswordPage() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'reset-password',
		constraint: getFieldsetConstraint(ResetPasswordSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ResetPasswordSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<div className="container flex flex-col justify-center pb-32 pt-20">
			<div className="text-center">
				<h1 className="text-h1">Password Reset</h1>
				<p className="mt-3 text-body-md text-muted-foreground">
					Hi, {data.resetPasswordUsername}. No worries. It happens all the time.
				</p>
			</div>
			<div className="mx-auto mt-16 min-w-[368px] max-w-sm">
				<Form method="POST" {...form.props}>
					<Field
						labelProps={{
							htmlFor: fields.password.id,
							children: 'New Password',
						}}
						inputProps={{
							...conform.input(fields.password, { type: 'password' }),
							autoComplete: 'new-password',
							autoFocus: true,
						}}
						errors={fields.password.errors}
					/>
					<Field
						labelProps={{
							htmlFor: fields.confirmPassword.id,
							children: 'Confirm Password',
						}}
						inputProps={{
							...conform.input(fields.confirmPassword, { type: 'password' }),
							autoComplete: 'new-password',
						}}
						errors={fields.confirmPassword.errors}
					/>

					<ErrorList errors={form.errors} id={form.errorId} />

					<StatusButton
						className="w-full"
						status={isPending ? 'pending' : actionData?.status ?? 'idle'}
						type="submit"
						disabled={isPending}
					>
						Reset password
					</StatusButton>
				</Form>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
