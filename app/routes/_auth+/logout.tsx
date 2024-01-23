import { type ActionFunctionArgs, redirect } from '@remix-run/node'
import { logout } from '~/utils/auth.server'

export async function loader() {
	// we'll keep this around in case the user ends up on this route. They
	// shouldn't see anything here anyway, so we'll just redirect them to the
	// home page.
	return redirect('/')
}

export async function action({ request }: ActionFunctionArgs) {
	throw await logout({ request })
}
