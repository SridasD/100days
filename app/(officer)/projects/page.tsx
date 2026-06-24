import { redirect } from 'next/navigation';

// /projects → /officer/projects (canonical URL per Blueprint Appendix C.11).
export default function ProjectsRedirect() {
  redirect('/officer/projects');
}
