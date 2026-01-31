import Button from '@/components/ui/Button';
import { MAIN_APP_URL } from '@/api/config';

function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-xl rounded-[32px] border border-border bg-card p-10 text-center shadow-xl">
        <h1 className="text-2xl font-semibold">Acces admin requis</h1>
        <p className="mt-4 text-mutedForeground">
          Vous devez etre connecte avec un compte administrateur pour acceder a cette application.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => window.location.assign(`${MAIN_APP_URL}/login`)}>
            Aller au login
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AccessDenied;
