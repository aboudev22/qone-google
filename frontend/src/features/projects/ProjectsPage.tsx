import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  FolderKanban,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { authApi, type DirectoryUser } from "../../shared/api/auth";
import {
  projectsApi,
  tasksApi,
  teamApi,
  type Project,
  type ProjectStatus,
  type TaskItem,
  type TaskPriority,
  type TaskStatus,
  type TeamMember,
} from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Actif",
  paused: "En pause",
  completed: "Terminé",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  review: "En revue",
  done: "Terminé",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
};

export const ProjectsPage: React.FC = () => {
  const { user, currentCompany } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [companyMembers, setCompanyMembers] = useState<TeamMember[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create Project Modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Create / Edit Task Modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("todo");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);

  // GitHub-style Collaborator Search & Invite
  const [collabQuery, setCollabQuery] = useState("");
  const [collabResults, setCollabResults] = useState<DirectoryUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isInvitingCollab, setIsInvitingCollab] = useState(false);

  const canManageAdmin =
    currentCompany?.role === "owner" || currentCompany?.role === "admin";

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projRes, taskRes, teamRes] = await Promise.all([
        projectsApi.list(),
        tasksApi.list(),
        teamApi.list(),
      ]);
      setProjects(projRes.projects);
      setTasks(taskRes.tasks);
      setCompanyMembers(teamRes.members);
      setSelectedProjectId((prev) => {
        if (prev && projRes.projects.some((p) => p.id === prev)) return prev;
        return projRes.projects[0]?.id || "";
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger les projets.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
  }, [loadAll]);

  useEffect(() => {
    const q = collabQuery.trim();
    if (!canManageAdmin || q.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      setIsSearchingUsers(true);
      void authApi
        .searchUsers(q)
        .then((res) => setCollabResults(res.users))
        .catch(() => setCollabResults([]))
        .finally(() => setIsSearchingUsers(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [collabQuery, canManageAdmin]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const projectTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (activeProject && t.projectId !== activeProject.id) return false;
      if (assigneeFilter === "mine" && t.assigneeUserId !== user?.id) return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "mine" &&
        t.assigneeUserId !== assigneeFilter
      ) {
        return false;
      }
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, activeProject, assigneeFilter, statusFilter, user?.id]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setIsSavingProject(true);
    setError(null);
    try {
      const res = await projectsApi.create({
        name: projectName.trim(),
        description: projectDescription.trim(),
      });
      setProjectName("");
      setProjectDescription("");
      setProjectModalOpen(false);
      await loadAll();
      setSelectedProjectId(res.project.id);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible de créer le projet.",
      );
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    setError(null);
    try {
      await projectsApi.remove(project.id);
      setNotice(`Projet « ${project.name} » supprimé.`);
      await loadAll();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible de supprimer ce projet.",
      );
    }
  };

  const handleAddCollaborator = async (
    payload: { userId?: string; email?: string; directAdd?: boolean },
  ) => {
    if (!activeProject) return;
    setIsInvitingCollab(true);
    setError(null);
    setNotice(null);
    try {
      const res = await projectsApi.addMember(activeProject.id, payload);
      setNotice(res.message);
      setCollabQuery("");
      setCollabResults([]);
      await loadAll();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'ajouter ce collaborateur au projet.",
      );
    } finally {
      setIsInvitingCollab(false);
    }
  };

  const handleRemoveProjectMember = async (memberUserId: string) => {
    if (!activeProject) return;
    setError(null);
    try {
      await projectsApi.removeMember(activeProject.id, memberUserId);
      await loadAll();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de retirer ce membre du projet.",
      );
    }
  };

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskStatus("todo");
    setTaskPriority("medium");
    setTaskAssigneeId(activeProject?.members[0]?.userId || user?.id || "");
    setTaskDueDate("");
    setTaskModalOpen(true);
  };

  const openEditTask = (task: TaskItem) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description);
    setTaskStatus(task.status);
    setTaskPriority(task.priority);
    setTaskAssigneeId(task.assigneeUserId || "");
    setTaskDueDate(task.dueDate);
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !taskTitle.trim()) return;
    setIsSavingTask(true);
    setError(null);
    try {
      if (editingTask) {
        await tasksApi.update(editingTask.id, {
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          status: taskStatus,
          priority: taskPriority,
          assigneeUserId: taskAssigneeId || null,
          dueDate: taskDueDate,
        });
      } else {
        await tasksApi.create({
          projectId: activeProject.id,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          status: taskStatus,
          priority: taskPriority,
          assigneeUserId: taskAssigneeId || null,
          dueDate: taskDueDate,
        });
      }
      setTaskModalOpen(false);
      await loadAll();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible d'enregistrer la tâche.",
      );
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleQuickTaskStatus = async (task: TaskItem, nextStatus: TaskStatus) => {
    setError(null);
    try {
      await tasksApi.update(task.id, { status: nextStatus });
      await loadAll();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de mettre à jour le statut.",
      );
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setError(null);
    try {
      await tasksApi.remove(taskId);
      await loadAll();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible de supprimer la tâche.",
      );
    }
  };

  const projectMemberIds = useMemo(
    () => new Set(activeProject?.members.map((m) => m.userId) || []),
    [activeProject],
  );

  const availableCompanyMembersToAdd = useMemo(
    () => companyMembers.filter((m) => !projectMemberIds.has(m.userId)),
    [companyMembers, projectMemberIds],
  );

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="text-[11px] text-faint uppercase tracking-wider">
            02 / Module Projets & Tâches
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Projets, Collaborateurs & Tâches
          </h1>
          <p className="mt-1 text-xs text-muted">
            Invitez vos employés par email sur chaque projet et attribuez les tâches à chacun.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeProject && (
            <button
              type="button"
              onClick={openCreateTask}
              className="flex items-center gap-2 border border-line-strong bg-panel px-4 py-2 text-xs text-fg hover:border-fg transition-colors whitespace-nowrap"
            >
              <Plus size={13} />
              <span>Nouvelle tâche</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setProjectModalOpen(true)}
            className="flex items-center gap-2 bg-fg px-4 py-2 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors whitespace-nowrap"
          >
            <FolderKanban size={13} />
            <span>Nouveau projet</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="border border-line-strong bg-panel p-4 text-xs text-fg"
        >
          {error}
        </div>
      )}

      {notice && (
        <div className="border border-line-strong bg-panel p-4 text-xs text-fg flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-accent shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="border border-line bg-panel p-10 text-xs text-muted flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Chargement des projets et tâches...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-line bg-panel p-12 text-center space-y-4">
          <FolderKanban size={24} className="mx-auto text-muted" />
          <div>
            <h2 className="text-sm font-medium text-fg">
              Aucun projet pour le moment
            </h2>
            <p className="mt-1 text-xs text-muted">
              Créez votre premier projet pour inviter des collaborateurs et distribuer les tâches.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProjectModalOpen(true)}
            className="inline-flex items-center gap-2 bg-fg px-4 py-2 text-xs font-medium text-canvas hover:bg-[#dedede]"
          >
            <Plus size={13} />
            <span>Créer un projet</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* Project selector sidebar */}
          <div className="border border-line bg-panel divide-y divide-line">
            <div className="px-4 py-3 text-[11px] text-faint uppercase tracking-wider bg-panel-raised">
              Projets ({projects.length})
            </div>
            {projects.map((p) => {
              const active = p.id === activeProject?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors space-y-1.5 ${
                    active ? "bg-panel-raised border-l-2 border-l-accent" : "hover:bg-panel-raised/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-fg truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-faint shrink-0">
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-faint tabular-nums">
                    <span>{p.members.length} membre(s)</span>
                    <span>
                      {p.taskStats.done}/{p.taskStats.total} tâches
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeProject && (
            <div className="space-y-6 min-w-0">
              {/* Project Header + Collaborators (GitHub-style) */}
              <div className="border border-line bg-panel p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-medium text-fg">
                        {activeProject.name}
                      </h2>
                      <span className="border border-line px-2 py-0.5 text-[10px] text-muted">
                        {PROJECT_STATUS_LABELS[activeProject.status]}
                      </span>
                    </div>
                    {activeProject.description && (
                      <p className="mt-1.5 text-xs text-muted">
                        {activeProject.description}
                      </p>
                    )}
                  </div>

                  {canManageAdmin && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteProject(activeProject)}
                      className="p-2 text-muted hover:text-accent border border-line hover:border-line-strong"
                      title="Supprimer le projet"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Project Collaborators Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-fg">
                      <Users size={14} className="text-accent" />
                      <span>Collaborateurs sur ce projet ({activeProject.members.length})</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeProject.members.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center gap-2 border border-line bg-canvas px-3 py-1.5 text-xs"
                      >
                        <span className="text-fg font-medium">
                          {m.firstName} {m.lastName}
                        </span>
                        <span className="text-[11px] text-faint">({m.email})</span>
                        {canManageAdmin && activeProject.members.length > 1 && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveProjectMember(m.userId)}
                            className="text-muted hover:text-accent ml-1"
                            title="Retirer du projet"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Quick Add from Company Members */}
                  {availableCompanyMembersToAdd.length > 0 && (
                    <div className="pt-2 space-y-2">
                      <p className="text-[11px] text-faint uppercase tracking-wider">
                        Ajouter un membre de l'entreprise au projet
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableCompanyMembersToAdd.map((m) => (
                          <button
                            key={m.userId}
                            type="button"
                            disabled={isInvitingCollab}
                            onClick={() =>
                              void handleAddCollaborator({ userId: m.userId })
                            }
                            className="flex items-center gap-1.5 border border-line bg-panel-raised px-2.5 py-1.5 text-[11px] text-muted hover:text-fg hover:border-line-strong transition-colors"
                          >
                            <Plus size={11} />
                            <span>
                              {m.firstName} {m.lastName} ({m.email})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Platform Users by Email or Name (GitHub style) */}
                  {canManageAdmin && (
                    <div className="pt-2 border-t border-line space-y-3">
                      <label
                        htmlFor="project-collab-search"
                        className="block text-[11px] text-faint uppercase tracking-wider"
                      >
                        Inviter un employé inscrit sur la plateforme (par email ou nom)
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search
                            size={13}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
                          />
                          <input
                            id="project-collab-search"
                            type="text"
                            value={collabQuery}
                            onChange={(e) => {
                              const next = e.target.value;
                              setCollabQuery(next);
                              if (next.trim().length < 2) setCollabResults([]);
                            }}
                            placeholder="Tapez un email (ex: employé@mail.com) ou un nom..."
                            className="w-full bg-canvas border border-line pl-9 pr-3 py-2 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none"
                          />
                        </div>
                        {collabQuery.includes("@") && (
                          <button
                            type="button"
                            disabled={isInvitingCollab}
                            onClick={() =>
                              void handleAddCollaborator({ email: collabQuery.trim() })
                            }
                            className="px-3.5 py-2 border border-line-strong bg-panel-raised text-xs text-fg hover:border-fg flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <UserPlus size={13} />
                            <span>Inviter cet email</span>
                          </button>
                        )}
                      </div>

                      {isSearchingUsers && (
                        <p className="text-[11px] text-faint">Recherche en cours...</p>
                      )}

                      {collabResults.length > 0 && (
                        <div className="border border-line bg-canvas divide-y divide-line">
                          {collabResults.map((u) => {
                            const inProject = projectMemberIds.has(u.id);
                            return (
                              <div
                                key={u.id}
                                className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="text-fg font-medium">
                                    {u.firstName} {u.lastName}{" "}
                                    {u.jobTitle && (
                                      <span className="text-[11px] text-faint font-normal">
                                        · {u.jobTitle}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-faint">{u.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {inProject ? (
                                    <span className="text-[11px] text-accent">
                                      Déjà sur le projet
                                    </span>
                                  ) : u.alreadyMember ? (
                                    <button
                                      type="button"
                                      disabled={isInvitingCollab}
                                      onClick={() =>
                                        void handleAddCollaborator({ userId: u.id })
                                      }
                                      className="px-3 py-1 bg-fg text-canvas text-[11px] font-medium hover:bg-[#dedede]"
                                    >
                                      Ajouter au projet
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isInvitingCollab}
                                        onClick={() =>
                                          void handleAddCollaborator({
                                            userId: u.id,
                                            directAdd: true,
                                          })
                                        }
                                        className="px-3 py-1 bg-fg text-canvas text-[11px] font-medium hover:bg-[#dedede]"
                                      >
                                        Ajouter directement
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isInvitingCollab}
                                        onClick={() =>
                                          void handleAddCollaborator({
                                            userId: u.id,
                                            directAdd: false,
                                          })
                                        }
                                        className="px-3 py-1 border border-line text-[11px] text-muted hover:text-fg hover:border-line-strong"
                                      >
                                        Envoyer invitation
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tasks Section */}
              <div className="border border-line bg-panel">
                <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-fg">
                      Tâches ({projectTasks.length})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filtrer par employé"
                      value={assigneeFilter}
                      onChange={(e) => setAssigneeFilter(e.target.value)}
                      className="bg-canvas border border-line px-2.5 py-1.5 text-xs text-fg focus:border-fg focus:outline-none"
                    >
                      <option value="all">Tous les assignés</option>
                      <option value="mine">Mes tâches</option>
                      {companyMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.firstName} {m.lastName}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filtrer par statut"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-canvas border border-line px-2.5 py-1.5 text-xs text-fg focus:border-fg focus:outline-none"
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="todo">À faire</option>
                      <option value="in_progress">En cours</option>
                      <option value="review">En revue</option>
                      <option value="done">Terminé</option>
                    </select>

                    <button
                      type="button"
                      onClick={openCreateTask}
                      className="px-3 py-1.5 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] flex items-center gap-1.5"
                    >
                      <Plus size={12} />
                      <span>Tâche</span>
                    </button>
                  </div>
                </div>

                {projectTasks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-faint">
                    Aucune tâche correspondant à ces filtres.
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {projectTasks.map((task) => (
                      <div
                        key={task.id}
                        className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-panel-raised/40"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`size-2 rounded-full shrink-0 ${
                                task.status === "done"
                                  ? "bg-fg"
                                  : task.priority === "high"
                                  ? "bg-accent"
                                  : "bg-muted"
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => openEditTask(task)}
                              className={`text-xs font-medium text-left hover:underline ${
                                task.status === "done"
                                  ? "line-through text-muted"
                                  : "text-fg"
                              }`}
                            >
                              {task.title}
                            </button>
                            <span className="border border-line px-1.5 py-0.5 text-[10px] text-faint">
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-muted pl-4.5">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-faint pl-4.5">
                            <span>
                              Assigné à :{" "}
                              <strong className="text-fg font-normal">
                                {task.assigneeName || "Non assigné"}
                              </strong>
                            </span>
                            {task.dueDate && <span>Échéance : {task.dueDate}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            aria-label={`Statut de ${task.title}`}
                            value={task.status}
                            onChange={(e) =>
                              void handleQuickTaskStatus(
                                task,
                                e.target.value as TaskStatus,
                              )
                            }
                            className="bg-canvas border border-line px-2.5 py-1.5 text-xs text-fg focus:border-fg focus:outline-none"
                          >
                            {Object.entries(TASK_STATUS_LABELS).map(([k, lbl]) => (
                              <option key={k} value={k}>
                                {lbl}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleDeleteTask(task.id)}
                            className="p-1.5 text-muted hover:text-accent border border-transparent hover:border-line"
                            aria-label="Supprimer la tâche"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Project */}
      {projectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-line-strong bg-panel p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-fg">Nouveau projet</h2>
              <button
                type="button"
                onClick={() => setProjectModalOpen(false)}
                className="p-1 text-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label
                  htmlFor="proj-name"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Nom du projet *
                </label>
                <input
                  id="proj-name"
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex: Inventaire T3, Refonte site client..."
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="proj-desc"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="proj-desc"
                  rows={3}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Objectif et périmètre du projet..."
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingProject}
                  className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSavingProject ? "Création..." : "Créer le projet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Task */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg border border-line-strong bg-panel p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-fg">
                {editingTask ? "Modifier la tâche" : "Assigner une nouvelle tâche"}
              </h2>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="p-1 text-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label
                  htmlFor="task-title"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Titre de la tâche *
                </label>
                <input
                  id="task-title"
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex: Préparer la commande fournisseur"
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="task-desc"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Instructions / Détails
                </label>
                <textarea
                  id="task-desc"
                  rows={2}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="task-assignee"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Assigner à l'employé
                  </label>
                  <select
                    id="task-assignee"
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  >
                    <option value="">Non assigné</option>
                    {companyMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.firstName} {m.lastName} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="task-priority"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Priorité
                  </label>
                  <select
                    id="task-priority"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="task-status"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Statut
                  </label>
                  <select
                    id="task-status"
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  >
                    <option value="todo">À faire</option>
                    <option value="in_progress">En cours</option>
                    <option value="review">En revue</option>
                    <option value="done">Terminé</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="task-due"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Échéance
                  </label>
                  <input
                    id="task-due"
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingTask}
                  className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSavingTask ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
