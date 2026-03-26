"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Create" },
  { href: "/jobs", label: "Jobs" },
  { href: "/schedules", label: "Schedules" },
  { href: "/integrations", label: "Integrations" }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="app-nav">
      <nav className="app-nav__inner" aria-label="Primary">
        <Link href="/" className="app-nav__brand">
          Ambient Video Studio
        </Link>

        <div className="app-nav__links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`app-nav__link ${isActive(pathname, link.href) ? "app-nav__link--active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
