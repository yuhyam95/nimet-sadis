
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, LogIn } from 'lucide-react';
import Image from 'next/image';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button className="w-full" type="submit" disabled={pending}>
            {pending ? 'Signing in...' : 'Sign In'}
            <LogIn className="ml-2 h-4 w-4" />
        </Button>
    );
}

export default function LoginPage() {
    const [state, formAction] = useFormState(loginAction, undefined);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <Image src="https://nimet.gov.ng/assets/img/logo.png" alt="NiMet Logo" width={80} height={80} />
                </div>
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">NiMet-SADIS-Ingest</CardTitle>
                        <CardDescription>Enter your credentials to access the dashboard</CardDescription>
                    </CardHeader>
                    <form action={formAction}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="admin@nimet.gov.ng" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" name="password" type="password" required />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            {state?.message && (
                                <div className="flex items-center text-sm text-destructive p-2 bg-destructive/10 rounded-md">
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    <p>{state.message}</p>
                                </div>
                            )}
                            <SubmitButton />
                        </CardFooter>
                    </form>
                </Card>
                 <footer className="w-full text-center text-sm text-muted-foreground mt-8">
                    <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. Login.</p>
                </footer>
            </div>
        </div>
    );
}
