import PageHeader from '@/components/admin/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

function Settings() {
  return (
    <div>
      <PageHeader title="Parametres" description="Parametres applicatifs V1 (placeholders)." />

      <Card>
        <CardHeader>
          <CardTitle>Permissions admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-mutedForeground">
          <p>Role moderateur: a venir (non implemente en V1).</p>
          <p>Gestion des permissions fines: version suivante.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
