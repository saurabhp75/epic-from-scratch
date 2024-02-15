import { redirect, type LoaderFunctionArgs } from '@remix-run/node'
import {
	authenticator,
	getSessionExpirationDate,
	getUserId,
} from '~/utils/auth.server'
import { ProviderNameSchema, providerLabels } from '~/utils/connections'
import { prisma } from '~/utils/db.server'
import { combineHeaders, combineResponseInits } from '~/utils/misc'
import {
	destroyRedirectToHeader,
	getRedirectCookieValue,
} from '~/utils/redirect-cookie.server'
import { createToastHeaders, redirectWithToast } from '~/utils/toast.server'
import { verifySessionStorage } from '~/utils/verification.server'
import { handleNewSession } from './login'
import {
	onboardingEmailSessionKey,
	prefilledProfileKey,
	providerIdKey,
} from './onboarding_.$provider'

const destroyRedirectTo = { 'set-cookie': destroyRedirectToHeader }

export async function loader({ request, params }: LoaderFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)
	const redirectTo = getRedirectCookieValue(request)

	const label = providerLabels[providerName]

	const profile = await authenticator
		.authenticate(providerName, request, {
			throwOnError: true,
		})
		.catch(async error => {
			console.error(error)
			const loginRedirect = [
				'/login',
				redirectTo ? new URLSearchParams({ redirectTo }) : null,
			]
				.filter(Boolean)
				.join('?')
			throw await redirectWithToast(
				loginRedirect,
				{
					title: 'Auth Failed',
					description: `There was an error authenticating with ${label}.`,
					type: 'error',
				},
				{ headers: destroyRedirectTo },
			)
		})

	// handle the error thrown by logging the error and redirecting the user
	// to the login page with a toast message indicating that there was an error
	// authenticating with the provider.

	// console.log({ profile })

	// check db for an existing connection
	// via the providerName and providerId (profile.id) and select the userId
	const existingConnection = await prisma.connection.findUnique({
		select: { userId: true },
		where: {
			providerName_providerId: { providerName, providerId: profile.id },
		},
	})

	const userId = await getUserId(request)

	// if there's an existing connection and a userId, then there's a conflict... Either:
	// 1. The account is already connected to their own account
	// 2. The account is already connected to someone else's account
	// redirect to /settings/profile/connections with apprpropriate toast message
	if (existingConnection && userId) {
		throw await redirectWithToast(
			'/settings/profile/connections',
			{
				title: 'Already Connected',
				description:
					existingConnection.userId === userId
						? `Your "${profile.username}" ${label} account is already connected.`
						: `The "${profile.username}" ${label} account is already connected to another account.`,
			},
			{ headers: destroyRedirectTo },
		)
	}

	// If there's a userId, then they're trying to connect to github, so create a connection
	// for the currently logged in user and give them a toast message letting them
	// know it worked.
	if (userId) {
		await prisma.connection.create({
			data: { providerName, providerId: profile.id, userId },
		})
		throw await redirectWithToast(
			'/settings/profile/connections',
			{
				title: 'Connected',
				type: 'success',
				description: `Your "${profile.username}" ${label} account has been connected.`,
			},
			{ headers: destroyRedirectTo },
		)
	}

	// if there's an existing connection, then the user is trying to login.
	// create a new session for the existingConnection.userId
	// once you've updated login to export handleNewSession, return a call to it here.
	if (existingConnection) {
		return makeSession({
			request,
			userId: existingConnection.userId,
			redirectTo,
		})
	}

	// if the profile.email matches a user in the db, then link the account and
	// make a new session
	const user = await prisma.user.findUnique({
		select: { id: true },
		where: { email: profile.email.toLowerCase() },
	})
	if (user) {
		await prisma.connection.create({
			data: { providerName, providerId: profile.id, userId: user.id },
		})
		return makeSession(
			{
				request,
				userId: user.id,
				// send them to the connections page to see their new connection
				redirectTo: redirectTo ?? '/settings/profile/connections',
			},
			{
				// use `createToastHeaders` to add a header to create a toast message:
				headers: await createToastHeaders({
					type: 'success',
					title: 'Connected',
					description: `Your "${profile.username}" ${label} account has been connected.`,
				}),
			},
		)
	}

	// If none of the above condition matches, then the user is onboarding
	// using OAuth
	// Make sure the username matches our rules:
	// 1. only alphanumeric characters
	// 2. lowercase
	// 3. 3-20 characters long
	// replace invalid characters with "_"
	// return a redirect to `/onboarding/${providerName}` and commit the verify session storage
	const verifySession = await verifySessionStorage.getSession(
		request.headers.get('cookie'),
	)
	verifySession.set(onboardingEmailSessionKey, profile.email)
	verifySession.set(prefilledProfileKey, {
		...profile,
		username: profile.username
			?.replace(/[^a-zA-Z0-9_]/g, '_')
			.toLowerCase()
			.slice(0, 20)
			.padEnd(3, '_'),
	})
	// set the providerIdKey to the profile.id
	verifySession.set(providerIdKey, profile.id)
	const onboardingRedirect = [
		`/onboarding/${providerName}`,
		redirectTo ? new URLSearchParams({ redirectTo }) : null,
	]
		.filter(Boolean)
		.join('?')
	return redirect(onboardingRedirect, {
		headers: combineHeaders(
			{ 'set-cookie': await verifySessionStorage.commitSession(verifySession) },
			destroyRedirectTo,
		),
	})
}

async function makeSession(
	{
		request,
		userId,
		redirectTo,
	}: { request: Request; userId: string; redirectTo?: string | null },
	responseInit?: ResponseInit,
) {
	redirectTo ??= '/'
	const session = await prisma.session.create({
		select: { id: true, expirationDate: true, userId: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			userId,
		},
	})
	return handleNewSession(
		{ request, session, redirectTo, remember: true },
		combineResponseInits({ headers: destroyRedirectTo }, responseInit),
	)
}
