import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server'
import { ProviderNameSchema, providerLabels } from '~/utils/connections'
import { redirectWithToast } from '~/utils/toast.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)

	const label = providerLabels[providerName]

	const profile = await authenticator.authenticate(providerName, request, {
		throwOnError: true,
	})
	// 🐨 handle the error thrown by logging the error and redirecting the user
	// to the login page with a toast message indicating that there was an error
	// authenticating with the provider.

	console.log({ profile })

	throw await redirectWithToast('/login', {
		title: 'Auth Success (jk)',
		description: `You have successfully authenticated with ${label} (not really though...).`,
		type: 'success',
	})
}
