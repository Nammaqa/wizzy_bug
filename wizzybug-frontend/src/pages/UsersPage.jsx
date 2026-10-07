import React, { useMemo, useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
const {LayoutDashboard,Bug,Plus,Users,User,Settings,LogOut,Search,Bell,ChevronDown,ArrowUpRight,Clock3,CircleCheck,TriangleAlert,Filter,Download,Menu,X,ChevronRight,Paperclip,Send,CalendarDays,BarChart3,FolderKanban,Activity,ShieldCheck,Eye,EyeOff,Moon,Sun,UserCog,Mail,ClipboardList,RefreshCcw,FolderPlus,ArrowLeft,Trash2} = Icons;
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API, apiFetch, setToken } from '../config/api';
import { formatIST, formatISTLong, timeAgoIST, IST_TZ } from '../utils/date';
import { STATUS_LABELS, STATUS_VALUES, PRIORITY_LABELS, SEVERITY_TO_PRIORITY } from '../utils/constants';
import { Avatar, Logo, RoleBadge, Status } from '../components/Ui';
import { initialsOf, isAssignedToUser, priorityLabel, statusLabel, buildTimeline } from '../utils/formatters';

function InviteUserModal({ onClose, onInvited }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const handleInvite = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const name = e.target.name.value;
    const email = e.target.email.value;
    const role = e.target.role.value;

    try {
      const data = await apiFetch("/auth/invite", {
        method: "POST",
        body: JSON.stringify({ name, email, role }),
      });
      onInvited &&
        onInvited({
          _id: email,
          name,
          email,
          role,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
      setConfirmation({
        email,
        sent:
          data?.mailMode !== "unconfigured" &&
          data?.mailMode !== "preview",
        preview: data?.mailMode === "preview",
      });
    } catch (err) {
      setError(err.message || "Error inviting user");
      setLoading(false);
    }
  };

  return (
    <div
      className="overlay"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {confirmation ? (
        <section
          className="panel profileForm inviteConfirmation"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-confirmation-title"
        >
          <div className="inviteConfirmationIcon" aria-hidden="true">
            <Mail size={22} />
          </div>
          <h3 id="invite-confirmation-title">
            {confirmation.sent ? "Invitation sent" : "Invitation created"}
          </h3>
          <p>
            {confirmation.sent
              ? "An invitation email has been sent to:"
              : confirmation.preview
                ? "The invitation was created, but the backend only generated a preview; no email was sent to:"
                : "The invitation was created, but email delivery is not configured on the backend:"}
          </p>
          <strong className="inviteConfirmationEmail">{confirmation.email}</strong>
          <span
            className={`inviteDeliveryStatus ${confirmation.sent ? "sent" : "notSent"}`}
          >
            {confirmation.sent ? "Email sent" : "Email not sent"}
          </span>
          <button className="primary" type="button" onClick={onClose}>
            Done
          </button>
        </section>
      ) : (
      <form
        className="panel profileForm"
        onSubmit={handleInvite}
        style={{ width: "400px", padding: "30px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: 0 }}>Invite Team Member</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            <X size={20} />
          </button>
        </div>
        <p
          className="muted"
          style={{ marginTop: -10, marginBottom: 15, fontSize: 13 }}
        >
          <Mail size={13} style={{ verticalAlign: -2, marginRight: 4 }} />A real
          email with a sign-up link is sent to the address below.
        </p>
        {error && <div className="formError">{error}</div>}
        <label>
          Full Name
          <input
            name="name"
            required
            maxLength={40}
            pattern="[A-Za-z]+( [A-Za-z]+)*"
            title="Use letters only; spaces are allowed between names."
            onInput={(event) => {
              event.currentTarget.value = event.currentTarget.value.replace(/[^A-Za-z ]/g, "");
            }}
            placeholder="Jane Doe"
          />
        </label>
        <label>
          Email Address
          <input
            name="email"
            type="text"
            required
            maxLength={40}
            placeholder="jane@example.com"
          />
        </label>
        <label>
          Role
          <select name="role" className="roleSelect">
            <option value="developer">Developer</option>
            <option value="tester">Tester</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <div className="formActions" style={{ marginTop: "25px" }}>
          <button
            className="primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Sending invite..." : "Send Invite"}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}

function UsersPage({ users, bugs = [], currentUser, refreshUsers }) {
  const [showInvite, setShowInvite] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [localUsers, setLocalUsers] = useState(
    Array.isArray(users) ? users : [],
  );

  useEffect(() => {
    if (Array.isArray(users)) {
      setLocalUsers(users);
    }
  }, [users]);

  const sourceUsers = Array.isArray(users) && users.length ? users : localUsers;
  const withStats = (sourceUsers || []).map((u) => ({
    ...u,
    bugCount: bugs.filter(
      (b) => (b.assigneeIds || []).includes(u._id) || b.assignee === u.name,
    ).length,
  }));

  const rows = withStats.filter(
    (u) =>
      (roleFilter === "All" || u.role === roleFilter) &&
      (u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())),
  );

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeletingId(userToDelete._id);
    setDeleteError("");
    try {
      await apiFetch(`/users/${userToDelete._id}`, { method: "DELETE" });
      setLocalUsers((current) =>
        current.filter((user) => user._id !== userToDelete._id),
      );
      setUserToDelete(null);
      refreshUsers && refreshUsers();
    } catch (err) {
      setDeleteError(err.message || "Could not delete user");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <>
      {userToDelete && (
        <div
          className="overlay deleteConfirmOverlay"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setUserToDelete(null);
              setDeleteError("");
            }
          }}
        >
          <section
            className="panel deleteConfirmDialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            aria-describedby="delete-user-message"
          >
            <div className="modalHeading">
              <h3 id="delete-user-title">Delete user?</h3>
              <button
                type="button"
                aria-label="Close delete confirmation"
                disabled={Boolean(deletingId)}
                onClick={() => {
                  setUserToDelete(null);
                  setDeleteError("");
                }}
              >
                <X size={20} />
              </button>
            </div>
            <p id="delete-user-message">
              Delete <strong>{userToDelete.name}</strong>? They will be removed
              from project memberships and ticket assignments. This cannot be
              undone.
            </p>
            {deleteError && <div className="formError">{deleteError}</div>}
            <div className="deleteConfirmActions">
              <button
                className="outline"
                type="button"
                disabled={Boolean(deletingId)}
                onClick={() => {
                  setUserToDelete(null);
                  setDeleteError("");
                }}
              >
                Cancel
              </button>
              <button
                className="deleteConfirmButton"
                type="button"
                disabled={Boolean(deletingId)}
                onClick={confirmDelete}
              >
                <Trash2 size={15} />
                {deletingId ? "Deleting..." : "Delete user"}
              </button>
            </div>
          </section>
        </div>
      )}
      <div className="pageIntro">
        <div>
          <h2>User Management</h2>
          <p>Manage workspace access, roles, and team members. Admin-only.</p>
        </div>
        <button className="primary" onClick={() => setShowInvite(true)}>
          <Plus size={17} />
          Invite User
        </button>
      </div>
      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onInvited={(invitedUser) => {
            setLocalUsers((prev) => [invitedUser, ...prev]);
            refreshUsers && refreshUsers();
          }}
        />
      )}
      <div className="stats mini">
        <article>
          <div className="statIcon purple">
            <Users />
          </div>
          <span>Total Users</span>
          <strong>{withStats.length}</strong>
        </article>
        <article>
          <div className="statIcon blue">
            <Bug />
          </div>
          <span>Developers</span>
          <strong>
            {withStats.filter((u) => u.role === "developer").length}
          </strong>
        </article>
        <article>
          <div className="statIcon orange">
            <Eye />
          </div>
          <span>Testers</span>
          <strong>{withStats.filter((u) => u.role === "tester").length}</strong>
        </article>
        <article>
          <div className="statIcon green">
            <ShieldCheck />
          </div>
          <span>Admins</span>
          <strong>{withStats.filter((u) => u.role === "admin").length}</strong>
        </article>
      </div>
      <article className="panel userTable">
        <div className="tableTools">
          <label>
            <Search />
            <input
              placeholder="Search Users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            className="roleSelect"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="admin">Admin</option>
            <option value="developer">Developer</option>
            <option value="tester">Tester</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>USER</th>
              <th>ROLE</th>
              <th>ASSIGNED BUGS</th>
              <th>STATUS</th>
              <th>MEMBER SINCE (IST)</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.email}>
                <td>
                  <span className="person">
                    <Avatar text={initialsOf(u.name)} />
                    <span>
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <RoleBadge role={u.role} />
                </td>
                <td>{u.bugCount}</td>
                <td>
                  {u.status === "pending" ? (
                    <span className="status open">
                      <i />
                      Invite Pending
                    </span>
                  ) : (
                    <span className="status closed">
                      <i />
                      {u.status === "active" || u.status === "accepted"
                        ? "Accepted"
                        : "Active"}
                    </span>
                  )}
                </td>
                <td className="date">
                  {formatIST(u.createdAt, { withTime: false })}
                </td>
                <td>
                  {String(u._id) === String(currentUser?._id) ? (
                    <span className="muted">Current user</span>
                  ) : (
                    <button
                      className="deleteConfirmButton"
                      type="button"
                      aria-label={`Delete ${u.name}`}
                      disabled={Boolean(deletingId)}
                      onClick={() => {
                        setUserToDelete(u);
                        setDeleteError("");
                      }}
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="muted"
                  style={{ textAlign: "center", padding: "30px 0" }}
                >
                  No team members yet. Invite your first user to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </>
  );
}

export default UsersPage;
