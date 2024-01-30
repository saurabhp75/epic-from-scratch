import { generateTOTP } from '@epic-web/totp'
import {
	json,
	redirect,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
} from '@remix-run/node'
import { Link, Form, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Icon } from '~/components/ui/icon'
import { StatusButton } from '~/components/ui/status-button'
import { requireUserId } from '~/utils/auth.server'
import { validateCSRF } from '~/utils/csrf.server'
import { prisma } from '~/utils/db.server'
import { useIsPending } from '~/utils/misc'
import { twoFAVerificationType } from './profile.two-factor'
import { twoFAVerifyVerificationType } from './profile.two-factor.verify'

export async function loader({ request }: LoaderFunctionArgs) {
	// determine whether the user has 2fa
	const userId = await requireUserId(request)
	const verification = await prisma.verification.findUnique({
		where: { target_type: { type: twoFAVerificationType, target: userId } },
		select: { id: true },
	})
	// Set isTwoFAEnabled to true if user has 2fa
	return json({ isTwoFAEnabled: Boolean(verification) })
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	// generate the otp config with generateTOTP (you don't need the otp that's returned, just the config)
	const { otp: _otp, ...config } = generateTOTP()
	const verificationData = {
		...config,
		// the type should be twoFAVerifyVerificationType which you can get from './profile.two-factor.verify.tsx'
		type: twoFAVerifyVerificationType,
		// the target should be the userId
		target: userId,
		// Set the expiresAt to 10 minutes from now
		expiresAt: new Date(Date.now() + 1000 * 60 * 10),
	}
	// upsert the verification with the config.
	await prisma.verification.upsert({
		where: {
			target_type: { target: userId, type: twoFAVerifyVerificationType },
		},
		create: verificationData,
		update: verificationData,
	})
	return redirect('/settings/profile/two-factor/verify')
}

export default function TwoFactorRoute() {
	const data = useLoaderData<typeof loader>()
	const isPending = useIsPending()

	return (
		<div className="flex flex-col gap-4">
			{data.isTwoFAEnabled ? (
				<>
					<p className="text-lg">
						<Icon name="check">
							You have enabled two-factor authentication.
						</Icon>
					</p>
					<Link to="disable">
						<Icon name="lock-open-1">Disable 2FA</Icon>
					</Link>
				</>
			) : (
				<>
					<p>
						<Icon name="lock-open-1">
							You have not enabled two-factor authentication yet.
						</Icon>
					</p>
					<p className="text-sm">
						Two factor authentication adds an extra layer of security to your
						account. You will need to enter a code from an authenticator app
						like{' '}
						<a className="underline" href="https://1password.com/">
							1Password
						</a>{' '}
						to log in.
					</p>
					<Form method="POST">
						<AuthenticityTokenInput />
						<StatusButton
							type="submit"
							name="intent"
							value="enable"
							status={isPending ? 'pending' : 'idle'}
							disabled={isPending}
							className="mx-auto"
						>
							Enable 2FA
						</StatusButton>
					</Form>
				</>
			)}
		</div>
	)
}
