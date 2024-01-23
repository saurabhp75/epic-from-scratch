import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import { validateCSRF } from '~/utils/csrf.server'
import { sessionStorage } from '~/utils/session.server'

export async function loader() {
	// we'll keep this around in case the user ends up on this route. They
	// shouldn't see anything here anyway, so we'll just redirect them to the
	// home page.
	return redirect('/')
}

export async function action({ request }: ActionFunctionArgs) {
	// get the user's session from the request that's passed to the action
	// destroy the session and set the 'set-cookie' header
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)

	// We can use getSession() without param here is we just
	// want to destroy the session.
	const cookieSession = await sessionStorage.getSession(
		request.headers.get('cookie'),
	)
	return redirect('/', {
		headers: {
			'set-cookie': await sessionStorage.destroySession(cookieSession),
		},
	})
}
