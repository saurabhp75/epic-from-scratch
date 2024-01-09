import { Link, useParams } from '@remix-run/react'

export default function KodyProfileRoute() {
	const params = useParams()

	return (
		<div className="container mb-48 mt-36">
			{/*
				🐨 swap params.username with the user's name
				(💯 note, the user's name is not required, so as extra credit, add a
				fallback to the username)
			*/}
			<h1 className="text-h1">{params.username}</h1>
			<Link to="notes" className="underline">
				Notes
			</Link>
		</div>
	)
}
