import { type Connection, type Password, type User } from '@prisma/client'
import { redirect } from '@remix-run/node'
import bcrypt from 'bcryptjs'
import { Authenticator } from 'remix-auth'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { type ProviderName } from './connections'
import { connectionSessionStorage, providers } from './connections.server'
import { prisma } from './db.server'
import { combineResponseInits, downloadFile } from './misc'
import { type ProviderUser } from './providers/provider'
import { sessionStorage } from './session.server'

// We cannot simply import bcrypt in the routes
// file as bcrypt needs crypto, which will end up
// in the client bundle
export { bcrypt }

// create a SESSION_EXPIRATION_TIME variable here
// export a simple function that returns a new date that's the current time plus the SESSION_EXPIRATION_TIME
const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30
export const getSessionExpirationDate = () =>
	new Date(Date.now() + SESSION_EXPIRATION_TIME)

export const sessionKey = 'sessionId'
// create the authenticator here, pass the connectionSessionStorage
export const authenticator = new Authenticator<ProviderUser>(
	connectionSessionStorage,
)

for (const [providerName, provider] of Object.entries(providers)) {
	authenticator.use(provider.getAuthStrategy(), providerName)
}

export async function getUserId(request: Request) {
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)
	const sessionId = cookieSession.get(sessionKey)
	if (!sessionId) return null

	// query the sessionId table instead. Do a subquery to get the user id
	// make sure to only select sessions that have not yet expired!
	// https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#gt
	const session = await prisma.session.findUnique({
		select: { userId: true },
		where: { id: sessionId },
	})
	if (!session) {
		throw await logout({ request })
	}
	return session.userId
}

export async function login({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	const user = await verifyUserPassword({ username }, password)

	if (!user) return null
	const session = await prisma.session.create({
		select: { id: true, expirationDate: true, userId: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			userId: user.id,
		},
	})
	return session
}

export async function signup({
	email,
	username,
	password,
	name,
}: {
	email: User['email']
	username: User['username']
	name: User['name']
	password: string
}) {
	const hashedPassword = await getPasswordHash(password)

	const session = await prisma.session.create({
		select: { id: true, expirationDate: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			user: {
				create: {
					email: email.toLowerCase(),
					username: username.toLowerCase(),
					name,
					roles: { connect: { name: 'user' } },
					password: {
						create: {
							hash: hashedPassword,
						},
					},
				},
			},
		},
	})

	return session
}

export async function logout(
	{
		request,
		redirectTo = '/',
	}: {
		request: Request
		redirectTo?: string
	},
	responseInit?: ResponseInit,
) {
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)

	// get the sessionId from the cookieSession
	// delete the session from the database by that sessionId
	//it's possible the session doesn't exist, so handle that case gracefully
	// and make sure we don't prevent the user from logging out if that happens
	// don't wait for the session to be deleted before proceeding with the logout
	const sessionId = cookieSession.get(sessionKey)
	// delete the session if it exists, but don't wait for it, go ahead an log the user out
	// Ignore the errors
	if (sessionId)
		void prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {})
	throw redirect(
		safeRedirect(redirectTo),
		combineResponseInits(responseInit, {
			headers: {
				'set-cookie': await sessionStorage.destroySession(cookieSession),
			},
		}),
	)
}

export async function getPasswordHash(password: string) {
	const hash = await bcrypt.hash(password, 10)
	return hash
}

export async function verifyUserPassword(
	where: Pick<User, 'username'> | Pick<User, 'id'>,
	password: Password['hash'],
) {
	const userWithPassword = await prisma.user.findUnique({
		where,
		select: { id: true, password: { select: { hash: true } } },
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

	if (!isValid) {
		return null
	}

	return { id: userWithPassword.id }
}

// get the user's Id from the session if there's a userId,
// then throw a redirect to '/'(otherwise do nothing)
export async function requireAnonymous(request: Request) {
	const userId = await getUserId(request)
	if (userId) {
		throw redirect('/')
	}
}

// returns the userId if it exists and throws a redirect
// to the login page if no userId exists in the session.
export async function requireUserId(
	request: Request,
	{ redirectTo }: { redirectTo?: string | null } = {},
) {
	const userId = await getUserId(request)
	if (!userId) {
		// create a URL object with new URL(request.url)
		// if redirectTo was passed as an argument we'll just use that, otherwise
		// create the path to redirectTo by combining the url's pathname and search
		// construct the login redirect path so it ends up being something like
		// this: '/login?redirectTo=/protected/path'
		// don't include the redirectTo if it's null
		// update this redirect to use your loginRedirect
		const requestUrl = new URL(request.url)
		redirectTo =
			redirectTo === null
				? null
				: redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`
		const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
		const loginRedirect = ['/login', loginParams?.toString()]
			.filter(Boolean)
			.join('?')
		throw redirect(loginRedirect)
	}
	return userId
}

// If the user doesn't exist, log the user out with the logout utility.
// TypeScript is happiest when you do: "throw await logout({ request })"
// If the user does exist, then return the user.
export async function requireUser(request: Request) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		select: { id: true, username: true },
		where: { id: userId },
	})
	if (!user) {
		// user found in cookie but not
		// in db, so logout
		throw await logout({ request })
	}
	return user
}

// add a resetUserPassword function which accepts a username and password
// hash the password using bcrypt
// then update the password by the username
export async function resetUserPassword({
	username,
	password,
}: {
	username: User['username']
	password: string
}) {
	const hashedPassword = await bcrypt.hash(password, 10)
	return prisma.user.update({
		where: { username },
		data: {
			password: {
				update: {
					hash: hashedPassword,
				},
			},
		},
	})
}

// signupWithConnection takes: email, username, name, providerId, providerName, imageUrl
// Follow the example of signup above, except:
// - no password to create
// - nested create for the connection
// - if there's an imageUrl, you can create one using downloadFile(imageUrl)
export async function signupWithConnection({
	email,
	username,
	name,
	providerId,
	providerName,
	imageUrl,
}: {
	email: User['email']
	username: User['username']
	name: User['name']
	providerId: Connection['providerId']
	providerName: ProviderName
	imageUrl?: string
}) {
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			user: {
				create: {
					email: email.toLowerCase(),
					username: username.toLowerCase(),
					name,
					roles: { connect: { name: 'user' } },
					connections: { create: { providerId, providerName } },
					image: imageUrl
						? { create: await downloadFile(imageUrl) }
						: undefined,
				},
			},
		},
		select: { id: true, expirationDate: true },
	})

	return session
}
