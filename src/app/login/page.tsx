
'use client';

import { useTransition, useEffect } from 'react';
import { loginAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';


export default function LoginPage() {
    const [isPending, startTransition] = useTransition();
    const { toast, dismiss } = useToast();

    useEffect(() => {
        // Clear any lingering toasts on mount
        dismiss();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            const result = await loginAction(formData);
            if (result && !result.success) {
                 toast({
                    title: 'Login Failed',
                    description: result.message,
                    variant: 'destructive',
                });
            } else if (result && result.success) {
                // Authentication successful, set session token and redirect to home
                const sessionToken = `user_${Date.now()}`;
                localStorage.setItem('session', sessionToken);
                window.location.href = '/';
            }
        });
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <Image src="https://nimet.gov.ng/assets/img/logo.png" alt="NiMet Logo" width={80} height={80} />
                </div>
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">NiMet-SADIS</CardTitle>
                        <CardDescription>Enter your credentials to access the dashboard</CardDescription>
                    </CardHeader>
                    <form action={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input id="username" name="username" type="text" placeholder="admin" required disabled={isPending} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" name="password" type="password" required disabled={isPending} />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full" type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                                {isPending ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
                 <footer className="w-full text-center text-sm text-muted-foreground mt-8">
                    <p>&copy; {new Date().getFullYear()} NiMet-SADIS. Login.</p>
                </footer>
            </div>
        </div>
    );
}
