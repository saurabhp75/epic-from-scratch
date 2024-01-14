import {
	redirect,
	type MetaFunction,
	type ActionFunctionArgs,
} from '@remix-run/node'
import { Form } from '@remix-run/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { SpamError } from 'remix-utils/honeypot/server'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { honeypot } from '~/utils/honeypot.server'

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	// throw a 400 response if the name field is filled out
	// we'll implement signup later
	try {
		honeypot.check(formData)
	} catch (error) {
		if (error instanceof SpamError) {
			throw new Response('Form not submitted properly', { status: 400 })
		}
		throw error
	}
	return redirect('/')
}

export default function SignupRoute() {
	return (
		<div className="container flex min-h-full flex-col justify-center pb-32 pt-20">
			<div className="mx-auto w-full max-w-lg">
				<div className="flex flex-col gap-3 text-center">
					<h1 className="text-h1">Welcome aboard!</h1>
					<p className="text-body-md text-muted-foreground">
						Please enter your details.
					</p>
				</div>
				<Form
					method="POST"
					className="mx-auto flex min-w-[368px] max-w-sm flex-col gap-4"
				>
					{/* Render a hidden div with an "name" input */}
					{/* Think about the accessibility implications. */}
					{/* Make sure screen readers will ignore this field */}
					{/*
						Add a label to tell the user to not fill out
						the field in case they somehow notice it.
					*/}
					<HoneypotInputs />
					<div>
						<Label htmlFor="email-input">Email</Label>
						<Input autoFocus id="email-input" name="email" type="email" />
					</div>
					<Button className="w-full" type="submit">
						Create an account
					</Button>
				</Form>
			</div>
		</div>
	)
}

export const meta: MetaFunction = () => {
	return [{ title: 'Setup Epic Notes Account' }]
}
