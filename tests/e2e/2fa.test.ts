import { faker } from '@faker-js/faker'
import * as setCookieParser from 'set-cookie-parser'
import { expect, test } from '@/playwright-utils'
import { getSessionExpirationDate, sessionKey } from '~/utils/auth.server'
import { prisma } from '~/utils/db.server'
import { invariant } from '~/utils/misc'
import { sessionStorage } from '~/utils/session.server'

test('Users can add 2FA to their account and use it when logging in', async ({
	page,
	insertNewUser,
}) => {
	const password = faker.internet.password()
	const user = await insertNewUser({ password })
	invariant(user.name, 'User name is not defined')

	// by passing the cookieConfig to addCookies (note, you need to add the domain!)
	// so you can use {...cookieConfig, domain: 'localhost'}

	// The cookieConfig type can't be specific enough to satisfy the
	// requirements of addCookies. If you'd like to parse the cookieConfig with
	// zod to make it more type safe, be my guest, but I don't think it's necessary
	// in this case. Simply add `as any` to the cookieConfig and you'll be good to go.

	// create a new session for the user using prisma.session.create
	// you can reference the login utility from auth.server.ts if you need a reminder.
	const session = await prisma.session.create({
		data: {
			expirationDate: getSessionExpirationDate(),
			userId: user.id,
		},
		select: { id: true },
	})

	// get the cookieSession from sessionStorage.getSession
	const cookieSession = await sessionStorage.getSession()
	// set the sessionKey on the cookieSession to the session.id
	cookieSession.set(sessionKey, session.id)
	// parse the setCookie header using setCookieParser.parseString
	const cookieConfig = setCookieParser.parseString(
		// commit the cookieSession using sessionStorage.commitSession
		await sessionStorage.commitSession(cookieSession),
	) as any

	// Uncomment to see the contents of the cookie
	// console.log({ cookieConfig })
	// throw new Error(JSON.stringify({ cookieConfig }, null, 2))

	// add the cookie to the browser context using page.context().addCookies
	await page.context().addCookies([{ ...cookieConfig, domain: 'localhost' }])

	await page.goto('/settings/profile')

	await page.getByRole('link', { name: /enable 2fa/i }).click()

	await expect(page).toHaveURL(`/settings/profile/two-factor`)
	const main = page.getByRole('main')
	await main.getByRole('button', { name: /enable 2fa/i }).click()
})
