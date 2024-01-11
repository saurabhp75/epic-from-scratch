import { type MetaFunction } from '@remix-run/node'
import { type loader as notesLoader } from './notes'

export default function NotesIndexRoute() {
	return (
		<div className="container pt-12">
			<p className="text-body-md">Select a note</p>
		</div>
	)
}

export const meta: MetaFunction<
	null,
	{ 'routes/users+/$username_+/notes': typeof notesLoader }
> = ({ params, matches }) => {
	// use the matches from the parameters to find the route for notes by that ID
	// matches.find(m => m.id === 'routes/users+/$username_+/notes')
	// use the matches to find the notes route

	const notesMatch = matches.find(
		m => m.id === 'routes/users+/$username_+/notes',
	)
	const displayName = notesMatch?.data?.owner.name ?? params.username
	const noteCount = notesMatch?.data?.notes.length ?? 0
	const notesText = noteCount === 1 ? 'note' : 'notes'
	return [
		{ title: `${displayName}'s Notes | Epic Notes` },
		{
			name: 'description',
			content: `Checkout ${displayName}'s ${noteCount} ${notesText} on Epic Notes`,
		},
	]
}
