import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Moon, Sun, UserRound } from 'lucide-react';
import { useLogin, useSignUp } from '@workspace/api-client-react';
import { BrandMark } from '@/components/brand-mark';
import { useTheme } from '@/components/nova-shell';
import { Form } from '@/components/ui/form';

type AuthValues = { email: string; password: string; name?: string };

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const { theme, setTheme } = useTheme();
  const login = useLogin();
  const signUp = useSignUp();
  const mutation = signup ? signUp : login;
  const form = useForm<AuthValues>({ defaultValues: { email: '', password: '', name: '' } });

  const onSubmit = (values: AuthValues) => {
    setLocalError('');
    const data = signup ? values : { email: values.email, password: values.password };
    mutation.mutate({ data }, {
      onSuccess: () => setLocation('/chat'),
      onError: (error) => setLocalError(error instanceof Error ? error.message : 'We could not complete that request. Try again.'),
    });
  };

  return (
    <main className="nova-noise min-h-[100dvh] bg-background text-foreground">
      <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
        <section className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col">
          <BrandMark />
          <div className="relative z-10 mt-auto max-w-[470px] pb-8">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-primary-foreground/55">A quieter kind of intelligence</p>
            <h1 className="font-[var(--app-font-serif)] text-[clamp(3rem,5.2vw,5.3rem)] font-medium leading-[0.94] tracking-[-0.075em]">Think clearly.<br /><span className="text-accent">Move forward.</span></h1>
            <p className="mt-7 max-w-[350px] text-sm leading-6 text-primary-foreground/64">NOVA brings conversation, research, documents, and visual thinking into one calm workspace.</p>
          </div>
          <div className="absolute -right-16 top-28 size-72 rounded-full border border-accent/30" />
          <div className="absolute -right-4 top-42 size-44 rounded-full bg-accent/90 blur-[1px]" />
          <div className="absolute bottom-10 right-12 grid size-24 grid-cols-4 gap-2 opacity-40">{Array.from({ length: 16 }).map((_, i) => <span key={i} className={`size-1.5 rounded-full ${i % 3 === 0 ? 'bg-accent' : 'bg-primary-foreground/50'}`} />)}</div>
        </section>
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[420px] nova-rise">
            <div className="mb-12 flex items-center justify-between"><div className="lg:hidden"><BrandMark /></div><div className="flex items-center gap-3"><span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">NOVA / 01</span><button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} data-testid="button-auth-toggle-theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button></div></div>
            <div className="mb-9">
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-accent/25 text-accent-foreground"><LockKeyhole size={18} /></span>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{signup ? 'Create your workspace' : 'Welcome back'}</p>
              <h2 className="mt-2 font-[var(--app-font-serif)] text-4xl font-semibold tracking-[-0.06em]">{signup ? 'Start with a clear mind.' : 'Good to see you again.'}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{signup ? 'A focused place for the questions worth asking.' : 'Your thoughts, research, and work are waiting.'}</p>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid={`form-${signup ? 'signup' : 'login'}`}>
                {signup && <label className="block"><span className="mb-2 block text-xs font-semibold">Your name</span><div className="relative"><UserRound className="absolute left-3.5 top-3.5 text-muted-foreground" size={16} /><input {...form.register('name')} className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="What should NOVA call you?" data-testid="input-name" /></div></label>}
                <label className="block"><span className="mb-2 block text-xs font-semibold">Email address</span><div className="relative"><Mail className="absolute left-3.5 top-3.5 text-muted-foreground" size={16} /><input {...form.register('email', { required: 'Email is required' })} autoComplete="email" type="email" className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="you@studio.com" data-testid="input-email" /></div>{form.formState.errors.email && <span className="mt-1 block text-xs text-destructive">{form.formState.errors.email.message}</span>}</label>
                <label className="block"><span className="mb-2 block text-xs font-semibold">Password</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-3.5 text-muted-foreground" size={16} /><input {...form.register('password', { required: 'Password is required', minLength: { value: 8, message: 'Use at least 8 characters' } })} autoComplete={signup ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-12 text-sm outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20" placeholder="At least 8 characters" data-testid="input-password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'} data-testid="button-toggle-password">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{form.formState.errors.password && <span className="mt-1 block text-xs text-destructive">{form.formState.errors.password.message}</span>}</label>
                {localError && <div className="rounded-xl border border-destructive/25 bg-destructive/8 px-3.5 py-3 text-xs leading-5 text-destructive" role="alert" data-testid="status-auth-error">{localError}</div>}
                <button type="submit" disabled={mutation.isPending} className="group flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60" data-testid="button-submit-auth"><span>{mutation.isPending ? 'Opening your workspace…' : signup ? 'Create my workspace' : 'Continue to NOVA'}</span><ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></button>
              </form>
            </Form>
            <p className="mt-8 text-center text-sm text-muted-foreground">{signup ? 'Already have an account?' : 'New to NOVA?'} <Link href={signup ? '/login' : '/signup'} className="font-semibold text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-foreground" data-testid={`link-${signup ? 'login' : 'signup'}`}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
            <p className="mt-12 text-center text-[11px] leading-5 text-muted-foreground">By continuing, you agree to the NOVA terms and understand that your workspace is yours.</p>
          </div>
        </section>
      </div>
    </main>
  );
}