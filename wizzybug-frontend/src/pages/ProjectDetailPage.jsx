import { ArrowLeft, Bug, Users } from "lucide-react";
import BugTable from "../components/BugTable";

function ProjectDetailPage({ project, bugs, users = [], onBack, setSelected }) {
  const projectBugs = bugs.filter(
    (bug) => String(bug.projectId) === String(project._id),
  );
  const openBugs = projectBugs.filter((bug) => bug.status !== "closed").length;
  const members = new Set(
    (project.members || [])
      .map((member) => member?._id || member)
      .filter(Boolean)
      .map(String),
  );
  projectBugs.forEach((bug) => {
    (bug.assigneeIds || []).filter(Boolean).forEach((assigneeId) => {
      members.add(String(assigneeId));
    });
  });
  const projectMembers = Array.from(members).map((memberId) => {
    const projectMember = (project.members || []).find(
      (member) => String(member?._id || member) === memberId,
    );
    return users.find((member) => String(member?._id) === memberId) || projectMember || {
      _id: memberId,
      name: "Unnamed member",
      role: "Member",
    };
  });

  return (
    <section className="projectDetailPage">
      <button className="backButton" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        Back to projects
      </button>
      <div className="projectDetailHeader">
        <div>
          <div className="projectDetailIdentity">
            <span className="projectKey">
              {project.key || project.name.slice(0, 3).toUpperCase()}
            </span>
            <span className="status open">
              <i />
              {project.status || "active"}
            </span>
          </div>
          <h2>{project.name}</h2>
          <p>{project.description || "No description yet."}</p>
        </div>
      </div>
      <div className="projectDetailStats">
        <span>
          <Bug size={16} />
          {openBugs} open bugs
        </span>
        <div
          className="projectMemberSelect"
          tabIndex={0}
          aria-label="Project members"
        >
          <Users size={16} />
          <span className="projectMemberCount">
            {projectMembers.length
              ? `${projectMembers.length} members`
              : "No members"}
          </span>
          <div className="projectMemberPopover" role="list" aria-label="Project members">
            {projectMembers.length ? (
              projectMembers.map((member) => (
                <div className="projectMemberItem" key={member._id} role="listitem">
                  <span>{member.name || "Unnamed member"}</span>
                  <small>{member.role || "Member"}</small>
                </div>
              ))
            ) : (
              <div className="projectMemberItem" role="listitem">
                No members assigned
              </div>
            )}
          </div>
        </div>
      </div>
      <article className="panel projectBugList">
        <div className="projectBugListHeader">
          <div>
            <h3>Project bugs</h3>
            <p>Issues reported for {project.name}.</p>
          </div>
          <span>{projectBugs.length} total</span>
        </div>
        <BugTable bugs={projectBugs} setSelected={setSelected} />
      </article>
    </section>
  );
}

export default ProjectDetailPage;
