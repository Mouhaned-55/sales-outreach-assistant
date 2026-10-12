import { useCallback, useEffect, useState } from "react";
import {
  request,
  type Dashboard,
  type Offering,
  type Prospect,
  type Seller,
} from "./api";
import { EmptyState, Icon, Notice } from "./components";
import { BusinessPage, OfferingsPage, ProspectsPage } from "./pages";

type Page = "overview" | "business" | "offerings" | "prospects" | "outreach";
const navigation: { id: Page; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "business", label: "Business Profile" },
  { id: "offerings", label: "Offerings" },
  { id: "prospects", label: "Prospects" },
  { id: "outreach", label: "Outreach" },
];
type Workspace = {
  seller: Seller;
  offerings: Offering[];
  prospects: Prospect[];
  dashboard: Dashboard;
};

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [seller, offerings, prospects, dashboard] = await Promise.all([
      request<Seller>("/seller"),
      request<Offering[]>("/offerings"),
      request<Prospect[]>("/prospects"),
      request<Dashboard>("/dashboard"),
    ]);
    setData({ seller, offerings, prospects, dashboard });
    setError("");
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);
  useEffect(() => {
    void load();
  }, [load]);
  const afterSave = async () => {
    try {
      await refresh();
    } catch {
      const message =
        "Your change was saved, but the workspace could not refresh. Reload to see the latest data.";
      setError(message);
      throw new Error(message);
    }
  };
  const current = navigation.find((item) => item.id === page)!;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            if (!busy) setPage("overview");
          }}
          aria-label="Sales Outreach Assistant home"
          aria-disabled={busy}
        >
          <span className="brand-mark">
            <Icon name="outreach" size={23} />
          </span>
          <span>
            Outreach<span className="brand-sub">SALES ASSISTANT</span>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => setPage(item.id)}
              disabled={busy}
            >
              <Icon name={item.id} />
              <span>{item.label}</span>
              {item.id === "outreach" && <span className="nav-soon">Soon</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" />
          Your local workspace
          <p>
            A little preparation.
            <br />
            More meaningful conversations.
          </p>
        </div>
        <div className="workspace-user">
          <span className="avatar">
            {data?.seller.business_name.slice(0, 1).toUpperCase() || "Y"}
          </span>
          <div>
            <strong>{data?.seller.business_name || "Your business"}</strong>
            <span>Personal workspace</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace <span>/</span> <strong>{current.label}</strong>
          </div>
          <span className="local-tag">
            <span className="status-dot" />
            Local edition
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Notice error={error} />
          {error && (
            <button
              className="button secondary retry"
              onClick={() => void load()}
              disabled={loading || busy}
            >
              {loading ? "Loading…" : "Reload workspace"}
            </button>
          )}
          {loading && !data ? (
            <div className="loading" role="status">
              <span className="loader" />
              Loading your workspace…
            </div>
          ) : !data ? (
            <EmptyState icon="business" title="Let’s reconnect your workspace">
              Start the local backend and reload to access your saved work.
            </EmptyState>
          ) : (
            <>
              {page === "overview" && (
                <Overview data={data} navigate={setPage} />
              )}
              {page === "business" && (
                <BusinessPage
                  seller={data.seller}
                  onSaved={afterSave}
                  busy={busy}
                  setBusy={setBusy}
                />
              )}
              {page === "offerings" && (
                <OfferingsPage
                  offerings={data.offerings}
                  onSaved={afterSave}
                  busy={busy}
                  setBusy={setBusy}
                />
              )}
              {page === "prospects" && (
                <ProspectsPage
                  prospects={data.prospects}
                  onSaved={afterSave}
                  busy={busy}
                  setBusy={setBusy}
                />
              )}
              {page === "outreach" && <Outreach />}
            </>
          )}
          <footer>
            Built for thoughtful outreach.
            <span>Your preparation starts here.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Overview({
  data,
  navigate,
}: {
  data: Workspace;
  navigate: (page: Page) => void;
}) {
  const { dashboard } = data;
  const checklist: {
    done: boolean;
    page: Page;
    title: string;
    description: string;
  }[] = [
    {
      done: dashboard.seller_complete,
      page: "business",
      title: "Tell your business story",
      description: "Add your business name and what makes it useful.",
    },
    {
      done: dashboard.offering_count > 0,
      page: "offerings",
      title: "Build your offering catalog",
      description:
        "Add products or services manually. Uploads awaiting review do not count.",
    },
    {
      done: dashboard.prospect_count > 0,
      page: "prospects",
      title: "Get to know your prospects",
      description: "Save the businesses and people you want to reach.",
    },
  ];
  const complete = checklist.filter((item) => item.done).length;
  const next = checklist.find((item) => !item.done);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR OUTREACH, ORGANIZED</p>
          <h1>A good conversation starts here.</h1>
          <p>
            A clear picture of your business. The right context for every
            connection.
          </p>
        </div>
      </div>
      <section className="welcome-banner">
        <div>
          <span className="banner-label">MAKE YOURSELF READY</span>
          <h2>
            {complete === 3
              ? "Your foundation is in place."
              : "Small steps. Stronger connections."}
          </h2>
          <p>
            {complete === 3
              ? "Your business, catalog, and prospects are saved. Keep them up to date while outreach tools are on the way."
              : "Bring your business and prospects together in one place. Build the foundation for more personal outreach."}
          </p>
          <button
            className="button light"
            onClick={() => navigate(next?.page || "prospects")}
          >
            {next ? "Continue setup" : "View prospects"}
            <Icon name="arrow" size={17} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="art-node node-one">
            <Icon name="business" size={25} />
          </span>
          <span className="art-node node-two">
            <Icon name="prospects" size={25} />
          </span>
          <span className="art-center">
            <Icon name="outreach" size={45} />
          </span>
          <span className="art-dot" />
        </div>
      </section>
      <div className="stat-grid">
        <button className="stat-card" onClick={() => navigate("business")}>
          <span className="stat-top">
            Business profile
            <Icon name="business" />
          </span>
          <strong className="stat-word">
            {dashboard.seller_complete ? "Complete" : "Not complete"}
          </strong>
          <span className="stat-foot">
            {dashboard.seller_complete
              ? "Your story is ready"
              : "Add your name and description"}
            <Icon name="arrow" size={16} />
          </span>
        </button>
        <button className="stat-card" onClick={() => navigate("offerings")}>
          <span className="stat-top">
            Saved offerings
            <Icon name="offerings" />
          </span>
          <strong>
            {dashboard.offering_count.toString().padStart(2, "0")}
          </strong>
          <span className="stat-foot">
            Products and services
            <Icon name="arrow" size={16} />
          </span>
        </button>
        <button className="stat-card" onClick={() => navigate("prospects")}>
          <span className="stat-top">
            Saved prospects
            <Icon name="prospects" />
          </span>
          <strong>
            {dashboard.prospect_count.toString().padStart(2, "0")}
          </strong>
          <span className="stat-foot">
            Your next connections
            <Icon name="arrow" size={16} />
          </span>
        </button>
      </div>
      <div className="overview-grid">
        <section className="panel checklist">
          <div className="panel-heading">
            <div>
              <h2>Your setup checklist</h2>
              <p>A few essentials before your first outreach.</p>
            </div>
            <span className="count-label">{complete} of 3</span>
          </div>
          <progress aria-label="Setup completion" value={complete} max={3} />
          {checklist.map((item) => (
            <button
              className="checklist-item"
              key={item.page}
              onClick={() => navigate(item.page)}
            >
              <span className={`check-circle ${item.done ? "done" : ""}`}>
                {item.done ? <Icon name="check" size={15} /> : null}
              </span>
              <span>
                <strong>{item.title}</strong>
                <span className="sr-only">
                  {item.done ? "Completed" : "Not completed"}
                </span>
                <small>{item.description}</small>
              </span>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </section>
        <section className="panel next-chapter">
          <span className="pill">NEXT MILESTONE</span>
          <span className="chapter-icon">
            <Icon name="outreach" size={30} />
          </span>
          <h2>
            From context
            <br />
            to conversation.
          </h2>
          <p>
            Personalized email drafts, thoughtful reviews, and sending on your
            terms.
          </p>
          <button className="text-button" onClick={() => navigate("outreach")}>
            See what’s coming
            <Icon name="arrow" size={17} />
          </button>
        </section>
      </div>
      <section className="workspace-summary">
        <span className="small-icon">
          <Icon name="lock" size={18} />
        </span>
        <p>
          <strong>Your work stays on this device.</strong> This local workspace
          saves your business, offerings, and prospects. No emails are sent.
        </p>
      </section>
    </>
  );
}

function Outreach() {
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">THE NEXT CHAPTER</p>
        <h1>Thoughtful outreach. Coming next.</h1>
        <p>
          Your saved context is the foundation. The conversation tools are still
          to come.
        </p>
      </div>
      <section className="panel outreach-intro">
        <span className="pill">PLANNED · NOT AVAILABLE YET</span>
        <h2>
          Personal by design.
          <br />
          Approved by you.
        </h2>
        <p>
          In a future milestone, your business and prospect information will
          help shape relevant emails. You will review and approve each draft
          before anything is sent.
        </p>
        <div className="workflow">
          {[
            ["01", "Draft", "Create an email from your saved context."],
            ["02", "Review", "Check the message and make it your own."],
            ["03", "Approve", "Explicitly approve the final draft."],
            ["04", "Send", "Send only the approved email."],
          ].map(([number, title, description]) => (
            <div key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
              <small>
                <Icon name="lock" size={13} />
                Planned
              </small>
            </div>
          ))}
        </div>
        <div className="outreach-actions">
          <button className="button" disabled>
            Draft email — coming soon
          </button>
          <p>
            No AI generation, approval, or email delivery is connected in this
            version.
          </p>
        </div>
      </section>
    </>
  );
}
