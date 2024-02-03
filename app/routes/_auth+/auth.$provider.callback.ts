import { type LoaderFunctionArgs } from '@remix-run/node'
import { authenticator, getUserId } from '~/utils/auth.server'
import { ProviderNameSchema, providerLabels } from '~/utils/connections'
import { prisma } from '~/utils/db.server'
import { redirectWithToast } from '~/utils/toast.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const providerName = ProviderNameSchema.parse(params.provider)

	const label = providerLabels[providerName]

	const profile = await authenticator
		.authenticate(providerName, request, {
			throwOnError: true,
		})
		.catch(async error => {
			// console.error(error)
			throw await redirectWithToast('/login', {
				type: 'error',
				title: 'Auth Failed',
				description: `There was an error authenticating with ${label}.`,
			})
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
		throw await redirectWithToast('/settings/profile/connections', {
			title: 'Already Connected',
			description:
				existingConnection.userId === userId
					? `Your "${profile.username}" ${label} account is already connected.`
					: `The "${profile.username}" ${label} account is already connected to another account.`,
		})
	}

	throw await redirectWithToast('/login', {
		title: 'Auth Success (jk)',
		description: `You have successfully authenticated with ${label} (not really though...).`,
		type: 'success',
	})
}
