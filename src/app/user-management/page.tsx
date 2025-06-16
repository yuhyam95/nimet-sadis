
"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type { User, UserRole } from "@/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Edit3, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createUserAction, getUsersAction, deleteUserAction, type UserActionResponse } from "@/lib/actions";

const userRoles: UserRole[] = ["admin", "airport manager", "meteorologist"];
const stations: string[] = ["Lagos", "Abuja", "Kano", "Port Harcourt", "Enugu", "Kaduna", "Maiduguri", "Sokoto", "Ilorin", "Jos"];

const createUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(userRoles, {
    required_error: "You need to select a user role.",
  }),
  station: z.string({ required_error: "You need to select a station." }),
});

type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "meteorologist",
      station: undefined, 
    },
  });

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    const response = await getUsersAction();
    if (response.success && response.users) {
      setUsers(response.users);
    } else {
      toast({
        title: "Error Fetching Users",
        description: response.message || "Could not load users.",
        variant: "destructive",
      });
      setUsers([]); // Clear users on error
    }
    setIsLoadingUsers(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (data: CreateUserFormValues) => {
    startSubmitTransition(async () => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value as string);
      });

      const response = await createUserAction(formData);
      if (response.success && response.user) {
        toast({
          title: "User Created",
          description: `${response.user.username} has been added.`,
        });
        form.reset();
        setIsCreateUserDialogOpen(false);
        fetchUsers(); // Refetch users to include the new one
      } else {
        toast({
          title: "Error Creating User",
          description: response.message || "Could not create user.",
          variant: "destructive",
        });
      }
    });
  };

  const handleDeleteUser = async (userId: string) => {
    const response = await deleteUserAction(userId);
    if (response.success) {
      toast({
        title: "User Deleted",
        description: `User has been removed.`,
      });
      fetchUsers(); // Refetch users
    } else {
      toast({
        title: "Error Deleting User",
        description: response.message || "Could not delete user.",
        variant: "destructive",
      });
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 md:p-8 space-y-8 bg-background">
      <header className="w-full max-w-5xl flex items-center justify-between">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-primary tracking-tight">
            User Management
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Create, view, and manage user accounts and their roles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isCreateUserDialogOpen} onOpenChange={(isOpen) => {
            setIsCreateUserDialogOpen(isOpen);
            if (!isOpen) form.reset(); 
          }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-5 w-5" />
                Add New User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Enter the details for the new user. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-6 py-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="john_doe" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="user@example.com" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {userRoles.map((role) => (
                              <SelectItem key={role} value={role} className="capitalize">
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="station"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Station</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a station" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stations.map((station) => (
                              <SelectItem key={station} value={station}>
                                {station}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save User
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <div className="md:hidden">
            <SidebarTrigger />
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Current Users</CardTitle>
            <CardDescription>
              A list of all users in the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
                <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading users...</p>
                </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="mr-1 capitalize">
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>{user.station || 'N/A'}</TableCell>
                       <TableCell>
                        <Badge 
                          variant={user.status === 'active' ? 'default' : user.status === 'invited' ? 'outline' : 'destructive'} 
                          className={`capitalize ${user.status === 'active' ? 'bg-green-500 hover:bg-green-600' : user.status === 'invited' ? 'border-blue-500 text-blue-500' : ''}`}
                        >
                            {user.status}
                        </Badge>
                       </TableCell>
                      <TableCell>{format(new Date(user.createdAt), "PP")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                toast({ title: "Edit User (Placeholder)", description: `This would open an edit dialog for ${user.username}. Database integration for edit is not yet implemented.`})
                              }
                            >
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </main>
      <footer className="w-full max-w-5xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. User Management.</p>
      </footer>
    </div>
  );
}
