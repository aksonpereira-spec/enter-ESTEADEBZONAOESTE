import { Download, FileCode, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DownloadPage() {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = "/codigo-fonte.zip";
    link.download = "codigo-fonte-esteadeb.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const files = [
    { folder: "src/", files: ["main.tsx", "App.tsx", "router.tsx", "index.css"] },
    { folder: "src/contexts/", files: ["AuthContext.tsx"] },
    { folder: "src/types/", files: ["school.ts", "student.ts"] },
    { folder: "src/components/", files: ["ProtectedRoute.tsx"] },
    { folder: "src/pages/", files: ["Login.tsx", "Index.tsx", "MainApp.tsx", "StudentPortal.tsx", "LojaAluno.tsx"] },
    {
      folder: "src/components/tabs/",
      files: ["AlunosTab.tsx", "TurmasTab.tsx", "MensalidadeTab.tsx", "ChamadaTab.tsx", "FinanceiroTab.tsx", "FichasTab.tsx", "EstoqueTab.tsx", "ConfigTab.tsx"],
    },
    { folder: "src/integrations/supabase/", files: ["client.ts", "types.ts"] },
    { folder: "supabase/functions/", files: ["delete-student-account/index.ts"] },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <FileCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Código-Fonte — ESTEADEB</h1>
          <p className="text-muted-foreground text-sm">Todos os arquivos do sistema empacotados em um único ZIP</p>
        </div>

        {/* Download Card */}
        <div className="rounded-2xl border border-border bg-card p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <p className="font-semibold text-foreground">codigo-fonte-esteadeb.zip</p>
              <p className="text-xs text-muted-foreground mt-0.5">Inclui todos os arquivos .tsx, .ts, .css e migrações</p>
            </div>
            <Button onClick={handleDownload} className="gap-2 shrink-0">
              <Download className="w-4 h-4" />
              Baixar ZIP
            </Button>
          </div>

          {/* File list */}
          <div className="space-y-4">
            {files.map((group) => (
              <div key={group.folder}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono font-semibold text-muted-foreground">{group.folder}</span>
                </div>
                <div className="pl-5 flex flex-wrap gap-1.5">
                  {group.files.map((file) => (
                    <span
                      key={file}
                      className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Acesse <span className="font-mono">/download</span> a qualquer momento para baixar novamente
        </p>
      </div>
    </div>
  );
}
