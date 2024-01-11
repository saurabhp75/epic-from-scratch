import {
	json,
	type MetaFunction,
	type LoaderFunctionArgs,
} from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { db } from '~/utils/db.server'
import { invariantResponse } from '~/utils/misc'

export async function loader({ params }: LoaderFunctionArgs) {
	const { username } = params

	const user = db.user.findFirst({
		where: {
			username: { equals: username },
		},
	})

	// Replaced by invariantResponse() utility
	// if (!user) {
	// 	throw new Response('user not found', { status: 404 })
	// }
	invariantResponse(user, 'user not found', { status: 404 })

	return json({ user: { name: user?.name, username: user?.username } })
}

export default function KodyProfileRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="container mb-48 mt-36">
			<h1 className="text-h1">{data.user?.name ?? data?.user?.username}</h1>
			<Link to="notes" className="underline" prefetch="intent">
				Notes
			</Link>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.name ?? params.username
	return [
		{ title: `${displayName} | Epic Notes` },
		{ name: 'description', content: `Profile of ${displayName} on Epic Notes` },
	]
}
