import { createId as cuid } from '@paralleldrive/cuid2'
import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server'
import { connectionSessionStorage } from '~/utils/connections.server'

export async function loader() {
	return redirect('/login')
}

export async function action({ request }: ActionFunctionArgs) {
	const providerName = 'github'

	// check if the process.env.GITHUB_CLIENT_ID starts with "MOCK_"
	// if it does, then simulate what remix-auth and github would do if we were to authenticate with it.
	// 1. create a "connectionSession" variable using the connectionSessionStorage.getSession function
	// 2. create a "state" variable using the cuid library (import { createId as cuid } from '@paralleldrive/cuid2')
	// 3. set the "oauth2:state" key in the connectionSession to the state variable (this is what remix-auth uses to validate the state)
	// 4. create a "code" variable with the value "MOCK_GITHUB_CODE_KODY" (our github API mocks will handle this or any other value)
	// 5. create a "searchParams" variable with a new URLSearchParams instance with the following params:
	//    - code: the code variable
	//    - state: the state variable
	// 6. throw a redirect with the following url: `/auth/github/callback?${searchParams}`
	// 7. set the "set-cookie" header to the result of the connectionSessionStorage.commitSession function
	if (process.env.GITHUB_CLIENT_ID?.startsWith('MOCK_')) {
		const connectionSession = await connectionSessionStorage.getSession(
			request.headers.get('cookie'),
		)
		const state = cuid()
		connectionSession.set('oauth2:state', state)
		const code = 'MOCK_GITHUB_CODE_KODY'
		const searchParams = new URLSearchParams({ code, state })
		throw redirect(`/auth/github/callback?${searchParams}`, {
			headers: {
				'set-cookie':
					await connectionSessionStorage.commitSession(connectionSession),
			},
		})
	}

	return await authenticator.authenticate(providerName, request)
}
