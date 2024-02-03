import { redirect, type ActionFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server'
import { ProviderNameSchema } from '~/utils/connections'
import { handleMockAction } from '~/utils/connections.server'

export async function loader() {
	return redirect('/login')
}

export async function action({ request, params }: ActionFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)

	await handleMockAction(providerName, request)

	return await authenticator.authenticate(providerName, request)
}
