import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server'
import { redirectWithToast } from '~/utils/toast.server'

export async function loader({ request }: LoaderFunctionArgs) {
	// Log the request to see the code and state in the url
	// console.log(request.url)

	const providerName = 'github'

	const profile = await authenticator.authenticate(providerName, request, {
		throwOnError: true,
	})

	// log the profile
	console.log({ profile })

	throw await redirectWithToast('/login', {
		title: 'Auth Success (jk)',
		description: `You have successfully authenticated with GitHub (not really though...).`,
		type: 'success',
	})
}
