import { useEffect, useState, type FormEvent } from "react";
import {
  request,
  type Offering,
  type Prospect,
  type ProspectInput,
  type Seller,
} from "./api";
import { EmptyState, Field, Icon, Notice } from "./components";
import { CatalogUploads } from "./CatalogUploads";

export type SaveCallback = {
  onSaved: () => Promise<void>;
  busy: boolean;
  setBusy: (value: boolean) => void;
};

export function BusinessPage({
  seller,
  onSaved,
  busy,
  setBusy,
}: { seller: Seller } & SaveCallback) {
  const [name, setName] = useState(seller.business_name);
  const [description, setDescription] = useState(seller.description);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    setName(seller.business_name);
    setDescription(seller.description);
  }, [seller]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request("/seller", "PUT", {
        business_name: name.trim(),
        description: description.trim(),
      });
      await onSaved();
      setSuccess("Your business profile is saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">START WITH YOUR STORY</p>
        <h1>Business Profile</h1>
        <p>Give every future conversation a clear picture of what you do.</p>
      </div>
      <div className="editor-layout">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <h2>Your business</h2>
              <p>Describe your business in your own words.</p>
            </div>
            <Icon name="business" />
          </div>
          <Notice error={error} success={success} />
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <Field
                label="Business name"
                name="business-name"
                value={name}
                onChange={setName}
                placeholder="e.g. Bright Workspace"
              />
              <Field
                label="Business description"
                name="business-description"
                value={description}
                onChange={setDescription}
                multiline
                placeholder="What do you do, who do you help, and what sets you apart?"
              />
              <div className="form-footer">
                <span>Changes are saved when you click Save.</span>
                <button className="button" type="submit">
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
        <aside className="tip-card">
          <span className="small-icon">
            <Icon name="business" />
          </span>
          <h3>Make it sound like you.</h3>
          <p>
            A useful description explains who you help and the problems you
            solve. A few clear sentences are plenty.
          </p>
          <hr />
          <p>
            Your individual products and services belong in{" "}
            <strong>Offerings</strong>.
          </p>
        </aside>
      </div>
    </>
  );
}

export function OfferingsPage({
  offerings,
  onSaved,
  busy,
  setBusy,
}: { offerings: Offering[] } & SaveCallback) {
  const [editing, setEditing] = useState<Offering | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  function edit(item: Offering | "new") {
    setEditing(item);
    setName(item === "new" ? "" : item.name);
    setDescription(item === "new" ? "" : item.description);
    setError("");
    setSuccess("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(
        editing === "new" ? "/offerings" : `/offerings/${editing.id}`,
        editing === "new" ? "POST" : "PUT",
        { name: name.trim(), description: description.trim() },
      );
      setEditing(null);
      await onSaved();
      setSuccess("Offering saved to your catalog.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Offering) {
    if (
      !window.confirm(
        `Delete “${item.name}” from your catalog? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/offerings/${item.id}`, "DELETE");
      if (editing !== "new" && editing?.id === item.id) setEditing(null);
      await onSaved();
      setSuccess("Offering deleted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading heading-with-actions">
        <div>
          <p className="eyebrow">WHAT YOU BRING TO THE TABLE</p>
          <h1>
            Offerings <span className="heading-count">{offerings.length}</span>
          </h1>
          <p>Your products and services, all in one catalog.</p>
        </div>
        <div className="button-group">
          <button
            className="button"
            disabled={busy}
            onClick={() => edit("new")}
          >
            <Icon name="plus" size={17} />
            Add offering
          </button>
        </div>
      </div>
      <Notice error={error} success={success} />
      {editing && (
        <section className="panel form-panel inline-form">
          <h2>{editing === "new" ? "Add an offering" : "Edit offering"}</h2>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <Field
                label="Offering name"
                name="offering-name"
                value={name}
                onChange={setName}
              />
              <Field
                label="Description"
                name="offering-description"
                value={description}
                onChange={setDescription}
                multiline
                placeholder="Describe the product or service and how it helps."
              />
              <div className="form-footer">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button className="button" type="submit">
                  {busy ? "Saving…" : "Save offering"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <CatalogUploads busy={busy} setBusy={setBusy} />
      <section className="panel">
        <div className="panel-heading padded">
          <div>
            <h2>Your catalog</h2>
            <p>Products, services, and the value you offer.</p>
          </div>
          <span className="count-label">{offerings.length} saved</span>
        </div>
        {offerings.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Offering</th>
                  <th scope="col">Description</th>
                  <th scope="col" className="actions-column">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td className="description-cell">{item.description}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          disabled={busy}
                          onClick={() => edit(item)}
                          aria-label={`Edit ${item.name}`}
                        >
                          Edit
                        </button>
                        <button
                          className="danger-text"
                          disabled={busy}
                          onClick={() => void remove(item)}
                          aria-label={`Delete ${item.name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="offerings"
            title="Your catalog starts with one offering"
          >
            Add your first product or service manually. Uploaded catalogs stay
            separate while awaiting future review and mapping.
          </EmptyState>
        )}
      </section>
      <p className="below-note">
        Uploads do not create offerings or change these counts. AI review and
        mapping are planned. Excel and PDF uploads are not supported.
      </p>
    </>
  );
}

const emptyProspect: ProspectInput = {
  business_name: "",
  contact_name: "",
  email: "",
  description: "",
  needs: "",
};

export function ProspectsPage({
  prospects,
  onSaved,
  busy,
  setBusy,
}: { prospects: Prospect[] } & SaveCallback) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<ProspectInput>(emptyProspect);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const change = (key: keyof ProspectInput) => (value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  function edit(item?: Prospect) {
    setEditing(item?.id ?? "new");
    setForm(
      item
        ? {
            business_name: item.business_name,
            contact_name: item.contact_name,
            email: item.email,
            description: item.description,
            needs: item.needs,
          }
        : { ...emptyProspect },
    );
    setError("");
    setSuccess("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const values = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim()]),
      );
      await request(
        editing === "new" ? "/prospects" : `/prospects/${editing}`,
        editing === "new" ? "POST" : "PUT",
        values,
      );
      setEditing(null);
      await onSaved();
      setSuccess("Prospect saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Prospect) {
    if (
      !window.confirm(
        `Delete “${item.business_name}” and its prospect details? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await request(`/prospects/${item.id}`, "DELETE");
      if (editing === item.id) setEditing(null);
      await onSaved();
      setSuccess("Prospect deleted.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading heading-with-actions">
        <div>
          <p className="eyebrow">KNOW WHO YOU’RE REACHING</p>
          <h1>
            Prospects <span className="heading-count">{prospects.length}</span>
          </h1>
          <p>Keep the people, businesses, and context that matter together.</p>
        </div>
        <button className="button" disabled={busy} onClick={() => edit()}>
          <Icon name="plus" size={17} />
          Add prospect
        </button>
      </div>
      <Notice error={error} success={success} />
      {editing !== null && (
        <section className="panel form-panel inline-form">
          <h2>{editing === "new" ? "Add a prospect" : "Edit prospect"}</h2>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <div className="form-grid">
                <Field
                  label="Business name"
                  name="prospect-business"
                  value={form.business_name}
                  onChange={change("business_name")}
                />
                <Field
                  label="Contact name"
                  name="prospect-contact"
                  value={form.contact_name}
                  onChange={change("contact_name")}
                  required={false}
                />
              </div>
              <Field
                label="Email address"
                name="prospect-email"
                value={form.email}
                onChange={change("email")}
                type="email"
                placeholder="hello@example.com"
              />
              <Field
                label="Business description"
                name="prospect-description"
                value={form.description}
                onChange={change("description")}
                multiline
                placeholder="What does this business do?"
              />
              <Field
                label="Known needs and notes"
                name="prospect-needs"
                value={form.needs}
                onChange={change("needs")}
                multiline
                required={false}
                placeholder="Record what you already know about their needs."
              />
              <div className="form-footer">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button className="button" type="submit">
                  {busy ? "Saving…" : "Save prospect"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading padded">
          <div>
            <h2>Your connections in the making</h2>
            <p>Saved details for more relevant conversations.</p>
          </div>
          <span className="count-label">{prospects.length} saved</span>
        </div>
        {prospects.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Business</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Context</th>
                  <th scope="col" className="actions-column">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.business_name}</strong>
                      <small className="table-secondary">
                        {item.description}
                      </small>
                    </td>
                    <td>
                      {item.contact_name || (
                        <span className="muted">No contact name</span>
                      )}
                      <small className="table-secondary">{item.email}</small>
                    </td>
                    <td className="description-cell">
                      {item.needs || (
                        <span className="muted">No notes yet</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          disabled={busy}
                          onClick={() => edit(item)}
                          aria-label={`Edit ${item.business_name}`}
                        >
                          Edit
                        </button>
                        <button
                          className="danger-text"
                          disabled={busy}
                          onClick={() => void remove(item)}
                          aria-label={`Delete ${item.business_name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="prospects"
            title="Make room for your next connection"
          >
            Add a prospect and save what you know about their business and
            needs.
          </EmptyState>
        )}
      </section>
    </>
  );
}
