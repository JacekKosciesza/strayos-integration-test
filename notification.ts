export interface Project {
  name: string;
  date: string;
  images: string[];
}

export interface Notification {
  siteId: string;
  project: Project;
}
