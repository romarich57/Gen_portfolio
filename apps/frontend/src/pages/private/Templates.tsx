import { Card, CardContent } from '@/components/ui/Card';

function Templates() {
  return (
    <div className="space-y-6 animate-fadeUp">
      <h1 className="text-3xl font-display font-black uppercase tracking-tight">Templates CV</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {['Classique', 'Compact', 'Technique'].map((name) => (
          <Card key={name}>
            <CardContent className="space-y-4 p-5">
              <div className="aspect-[3/4] rounded border border-border bg-background p-4">
                <div className="h-5 w-2/3 bg-primary/70" />
                <div className="mt-5 space-y-2">
                  <div className="h-2 w-full bg-muted" />
                  <div className="h-2 w-4/5 bg-muted" />
                  <div className="h-2 w-3/5 bg-muted" />
                </div>
              </div>
              <p className="font-mono text-xs font-black uppercase tracking-widest">{name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default Templates;
