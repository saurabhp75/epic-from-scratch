import { Outlet } from '@remix-run/react'
import { Icon } from '~/components/ui/icon'
import { type VerificationTypes } from '~/routes/_auth+/verify'

// 🐨 export a twoFAVerificationType constant set to '2fa'
// 🦺 make it type-safer by adding "satisifes VerificationTypes"
export const twoFAVerificationType = '2fa' satisfies VerificationTypes

export const handle = {
	breadcrumb: <Icon name="lock-closed">2FA</Icon>,
}

export default function TwoFactorRoute() {
	return <Outlet />
}
