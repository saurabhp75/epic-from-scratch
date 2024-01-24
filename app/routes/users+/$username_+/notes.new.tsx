import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { requireUser } from '~/utils/auth.server'
import { invariantResponse } from '~/utils/misc'
import { action, NoteEditor } from './__note-editor'

export { action }
export default NoteEditor

export async function loader({ request, params }: LoaderFunctionArgs) {
	const user = await requireUser(request)
	invariantResponse(user.username === params.username, 'Not authorized', {
		status: 403,
	})
	return json({})
}
