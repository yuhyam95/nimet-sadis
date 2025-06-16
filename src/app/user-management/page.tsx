
"use client";

import React, { useState } from "react";
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
import { UserPlus, Edit3, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const userRoles: UserRole[] = ["admin", "airport manager", "meteorologist"];
const stations: string[] = ["Lagos", "Abuja", "Kano", "Port Harcourt", "Enugu", "Kaduna"];

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

// Mock initial users
const initialUsers: User[] = [
  {
    id: "1",
    username: "ada_admin",
    email: "ada@example.com",
    roles: ["admin"],
    createdAt: new Date(2023, 0, 15),
    status: "active",
    station: "Lagos",
  },
  {
    id: "2",
    username: "bola_manager",
    email: "bola@example.com",
    roles: ["airport manager"],
    createdAt: new Date(2023, 1, 20),
    status: "active",
    station: "Abuja",
  },
  {
    id: "3",
    username: "chi_met",
    email: "chi@example.com",
    roles: ["meteorologist"],
    createdAt: new Date(2023, 2, 10),
    status: "invited",
    station: "Kano",
  },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: "meteorologist",
      station: undefined, // Default to undefined so placeholder shows
    },
  });

  const handleCreateUser = (data: CreateUserFormValues) => {
    const newUser: User = {
      id: crypto.randomUUID(),
      username: data.username,
      email: data.email,
      roles: [data.role],
      createdAt: new Date(),
      status: "active", 
      station: data.station,
    };
    setUsers((prevUsers) => [newUser, ...prevUsers]);
    toast({
      title: "User Created (Mock)",
      description: `${newUser.username} has been added. Data is not persisted.`,
    });
    form.reset();
    setIsCreateUserDialogOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
    toast({
      title: "User Deleted (Mock)",
      description: `User with ID ${userId} has been removed. Data is not persisted.`,
      variant: "destructive",
    });
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
            if (!isOpen) form.reset(); // Reset form when dialog closes
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
                          <Input placeholder="john_doe" {...field} />
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
                          <Input type="email" placeholder="user@example.com" {...field} />
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
                          <Input type="password" placeholder="••••••••" {...field} />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Save User</Button>
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
              <span className="block text-xs text-amber-600 mt-1">Note: This is mock data. User creation, edits, and deletions are not persisted.</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined Date</TableHead>
                  {/* <TableHead>Station</TableHead> */} {/* Decide if station should be shown here */}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
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
                       <TableCell>
                        <Badge 
                          variant={user.status === 'active' ? 'default' : user.status === 'invited' ? 'outline' : 'destructive'} 
                          className={`capitalize ${user.status === 'active' ? 'bg-green-500 hover:bg-green-600' : user.status === 'invited' ? 'border-blue-500 text-blue-500' : ''}`}
                        >
                            {user.status}
                        </Badge>
                       </TableCell>
                      <TableCell>{format(user.createdAt, "PP")}</TableCell>
                      {/* <TableCell>{user.station || 'N/A'}</TableCell> */}
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
                                toast({ title: "Edit User (Mock)", description: `This would open an edit dialog for ${user.username}.`})
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
          </CardContent>
        </Card>
      </main>
      <footer className="w-full max-w-5xl text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} NiMet-SADIS-Ingest. User Management.</p>
      </footer>
    </div>
  );
}

