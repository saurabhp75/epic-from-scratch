import { faker } from '@faker-js/faker'
import { http } from 'msw'
import * as setCookieParser from 'set-cookie-parser'
// import the mock server from the mocks folder
// because it starts the server for us automatically, you don't have to worry
// about starting it, and it also handles stopping automatically as well.
// import '#tests/mocks/index.ts'
import { afterEach, expect, test } from 'vitest'
import { server } from '@/mocks/index'
import { consoleError } from '@/setup/setup-test-env'
import { connectionSessionStorage } from '~/utils/connections.server'
import { invariant } from '~/utils/misc'
import { loader } from './auth.$provider.callback'

const ROUTE_PATH = '/auth/github/callback'
const PARAMS = { provider: 'github' }
const BASE_URL = 'https://www.epicstack.dev'

afterEach(() => {
	server.resetHandlers()
})

test('a new user goes to onboarding', async () => {
	const request = await setupRequest()

	// call the loader with the request, an empty params object, and an empty context object
	const response = await loader({ request, params: PARAMS, context: {} })

	// assert the response is a redirect to `/onboarding/github`
	expect(response.headers.get('location')).toBe('/onboarding/github')
	assertRedirect(response, '/onboarding/github')
})

test('when auth fails, send the user to login with a toast', async () => {
	// in the error case, we call console.error, so you can use the consoleError
	// mock we wrote earlier. It's in '#tests/setup/setup-test-env.ts'. With that,
	// add a mock implementation so we don't throw an error, and then we can assert
	// that it was called once at the end of this test.
	consoleError.mockImplementation(() => {})

	// add a server.use here for a http.post to 'https://github.com/login/oauth/access_token'
	// it should return a response with "error" and a 400 status code
	// you'll find our happy-path mock implementation of this in '#tests/mocks/github.ts' if you're curious
	// this is all the same stuff as the last test:
	server.use(
		http.post('https://github.com/login/oauth/access_token', async () => {
			return new Response('error', { status: 400 })
		}),
	)

	const request = await setupRequest()

	// in the error case, this promise will reject, so you can add a try/catch
	// around it or use .catch to get the response
	const response = await loader({ request, params: PARAMS, context: {} }).catch(
		e => e,
	)
	invariant(response instanceof Response, 'response should be a Response')

	// assert a redirect to '/login'
	assertRedirect(response, '/login')

	// assert a toast was sent (you can use Kellie's assertToastSent util below)
	assertToastSent(response)

	// Assert consoleError was called once and make sure to call mockClear on it.
	expect(consoleError).toHaveBeenCalledTimes(1)
})

function assertToastSent(response: Response) {
	const setCookie = response.headers.get('set-cookie')
	invariant(setCookie, 'set-cookie header should be set')
	const parsedCookie = setCookieParser.splitCookiesString(setCookie)
	expect(parsedCookie).toEqual(
		expect.arrayContaining([expect.stringContaining('en_toast')]),
	)
}

// we're going to be asserting redirects a lot, so if you've got extra time
// make a helper function here called assertRedirect that takes a response and
// a redirectTo string. It should assert that the response has a 300 status code
// and that the location header is set to the redirectTo string.
function assertRedirect(response: Response, redirectTo: string) {
	expect(response.status).toBeGreaterThanOrEqual(300)
	expect(response.status).toBeLessThan(400)
	expect(response.headers.get('location')).toBe(redirectTo)
}

function convertSetCookieToCookie(setCookie: string) {
	const parsedCookie = setCookieParser.parseString(setCookie)
	return new URLSearchParams({
		[parsedCookie.name]: parsedCookie.value,
	}).toString()
}

async function setupRequest() {
	// create the URL with the ROUTE_PATH and the BASE_URL
	// tip: new URL('/some/path', 'https://example.com').toString() === 'https://example.com/some/path'
	const url = new URL(ROUTE_PATH, BASE_URL)

	// create the state and code  faker.string.uuid() should work fine)
	const state = faker.string.uuid()
	const code = faker.string.uuid()

	// set the url.searchParams for `state` and `code`
	url.searchParams.set('state', state)
	url.searchParams.set('code', code)

	// get the cookie session from the connectionSessionStorage.getSession() function
	const connectionSession = await connectionSessionStorage.getSession()

	// set the 'oauth2:state' value in the cookie session to the `state`
	connectionSession.set('oauth2:state', state)

	// get a set-cookie header from connectionSessionStorage.commitSession with the cookieSession
	const connectionSetCookieHeader =
		await connectionSessionStorage.commitSession(connectionSession)

	// create a new Request with the url.toString().
	// the method should be GET (since we're calling the loader)
	// the headers should include a cookie, use the convertSetCookieToCookie function below
	const request = new Request(url.toString(), {
		method: 'GET',
		headers: {
			cookie: convertSetCookieToCookie(connectionSetCookieHeader),
		},
	})

	return request
}
