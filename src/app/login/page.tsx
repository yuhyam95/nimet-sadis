
'use client';

import { useTransition } from 'react';
import { loginAction } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, LogIn, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';


export default function LoginPage() {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            const result = await loginAction(formData);
            if (result.success) {
                toast({ title: 'Login Successful', description: 'Welcome back!' });
                router.push('/');
                router.refresh(); // Recommended to refresh router cache
            } else {
                 toast({
                    title: 'Login Failed',
                    description: result.message,
                    variant: 'destructive',
                });
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
                        <CardTitle className="text-2xl">NiMet-SADIS-Ingest</CardTitle>
                        <CardDescription>Enter your credentials to access the dashboard</CardDescription>
                    </CardHeader>
                    <form action={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" placeholder="admin@nimet.gov.ng" required disabled={isPending} />
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
                    <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. Login.</p>
                </footer>
            </div>
        </div>
    );
}
