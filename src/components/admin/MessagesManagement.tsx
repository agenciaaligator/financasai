import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { Mail, Search, Eye, Reply, Archive, Trash2, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useI18n } from "react-i18next";

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  created_at: string;
  read_at: string | null;
  replied_at: string | null;
  archived_at: string | null;
};

const PAGE_SIZE = 20;

export function MessagesManagement() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<ContactMessage | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      let query = supabase
        .from("contact_messages")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(`name.ilike.${s},email.ilike.${s},subject.ilike.${s}`);
      }

      const { data, error: err, count } = await query;
      if (err) throw err;
      setMessages((data ?? []) as ContactMessage[]);
      setTotal(count ?? 0);
      console.log("[AdminMessages] fetched", { count, page, statusFilter });
    } catch (e) {
      console.log("[AdminMessages] fetch error", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const updateStatus = async (msg: ContactMessage, newStatus: ContactMessage["status"]) => {
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "read") updates.read_at = new Date().toISOString();
    if (newStatus === "replied") updates.replied_at = new Date().toISOString();
    if (newStatus === "archived") updates.archived_at = new Date().toISOString();

    const { error: err } = await supabase.from("contact_messages").update(updates).eq("id", msg.id);
    if (err) {
      console.log("[AdminMessages] update error", err);
      toast.error(t("admin.messages.error"));
      return;
    }
    toast.success(t("admin.messages.updated"));
    setSelected(null);
    fetchMessages();
  };

  const deleteMessage = async (msg: ContactMessage) => {
    const { error: err } = await supabase.from("contact_messages").delete().eq("id", msg.id);
    if (err) {
      console.log("[AdminMessages] delete error", err);
      toast.error(t("admin.messages.error"));
      return;
    }
    toast.success(t("admin.messages.deleted"));
    setSelected(null);
    fetchMessages();
  };

  const openMessage = async (msg: ContactMessage) => {
    setSelected(msg);
    if (msg.status === "new") {
      await updateStatus(msg, "read");
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));

  const statusVariant = (s: ContactMessage["status"]) => {
    switch (s) {
      case "new": return "default";
      case "read": return "secondary";
      case "replied": return "outline";
      case "archived": return "outline";
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{t("admin.messages.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.messages.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                placeholder={t("admin.messages.search")}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="md:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.messages.filters.all")}</SelectItem>
                <SelectItem value="new">{t("admin.messages.filters.new")}</SelectItem>
                <SelectItem value="read">{t("admin.messages.filters.read")}</SelectItem>
                <SelectItem value="replied">{t("admin.messages.filters.replied")}</SelectItem>
                <SelectItem value="archived">{t("admin.messages.filters.archived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">{t("admin.messages.error")}</p>
              <Button variant="outline" onClick={fetchMessages}>{t("admin.messages.retry")}</Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Inbox className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">{t("admin.messages.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold truncate ${msg.status === "new" ? "text-foreground" : "text-muted-foreground"}`}>
                        {msg.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">&lt;{msg.email}&gt;</span>
                      <Badge variant={statusVariant(msg.status) as any} className="text-xs">
                        {t(`admin.messages.status.${msg.status}`)}
                      </Badge>
                    </div>
                    <p className={`text-sm truncate ${msg.status === "new" ? "font-medium" : ""}`}>
                      {msg.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</p>
                  </div>
                  <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {t("admin.messages.pageOf", { current: page + 1, total: totalPages })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words">{selected.subject}</DialogTitle>
                <DialogDescription>
                  <span className="font-medium">{selected.name}</span> &lt;{selected.email}&gt; · {formatDate(selected.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Badge variant={statusVariant(selected.status) as any}>
                  {t(`admin.messages.status.${selected.status}`)}
                </Badge>
                <div className="bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm">
                  {selected.message}
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const subject = encodeURIComponent(`Re: ${selected.subject}`);
                    window.open(`mailto:${selected.email}?subject=${subject}`, "_blank");
                  }}
                >
                  <Reply className="h-4 w-4 mr-2" />
                  {t("admin.messages.actions.reply")}
                </Button>
                {selected.status !== "replied" && (
                  <Button variant="outline" size="sm" onClick={() => updateStatus(selected, "replied")}>
                    {t("admin.messages.actions.markReplied")}
                  </Button>
                )}
                {selected.status !== "archived" && (
                  <Button variant="outline" size="sm" onClick={() => updateStatus(selected, "archived")}>
                    <Archive className="h-4 w-4 mr-2" />
                    {t("admin.messages.actions.archive")}
                  </Button>
                )}
                <DeleteConfirmationDialog
                  itemName={selected.subject}
                  itemType="transaction"
                  onConfirm={() => deleteMessage(selected)}
                >
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("admin.messages.actions.delete")}
                  </Button>
                </DeleteConfirmationDialog>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
