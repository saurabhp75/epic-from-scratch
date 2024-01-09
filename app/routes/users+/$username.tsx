import { type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData} from '@remix-run/react'
import { db } from '~/utils/db.server'

export async function loader({ params }: LoaderFunctionArgs) {
	const { username } = params

	const user = db.user.findFirst({
		where: {
			username: { equals: username },
		},
	})

	return { user }
}

export default function KodyProfileRoute() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="container mb-48 mt-36">
			<h1 className="text-h1">{data.user?.name ?? data?.user?.username}</h1>
			<Link to="notes" className="underline">
				Notes
			</Link>
		</div>
	)
}
