import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server'

export async function loader() {
	return redirect('/login')
}

export async function action({ request }: ActionFunctionArgs) {
	const providerName = 'github'

	return await authenticator.authenticate(providerName, request)
}
