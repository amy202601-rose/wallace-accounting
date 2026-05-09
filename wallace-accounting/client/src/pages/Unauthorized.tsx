import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">无权访问</h1>
        <p className="text-muted-foreground mb-2">
          您的账号未获授权访问此系统。
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          此系统仅限内部授权人员使用。如需访问权限，请联系系统管理员。
        </p>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = getLoginUrl();
          }}
        >
          使用其他账号登录
        </Button>
      </div>
    </div>
  );
}
