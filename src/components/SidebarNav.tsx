import React from 'react';
import SidebarNavItem from './SidebarNavItem';

export interface NavigationItem {
  id: string;
  icon: React.ReactNode;
  label: string;
}

export interface SidebarNavProps {
  items: NavigationItem[];
  activeItem: string;
  onSelect: (id: string) => void;
}

export default function SidebarNav({ items, activeItem, onSelect }: SidebarNavProps) {
  return (
    <nav aria-label="Main Navigation" style={{ flex: 1, overflowY: 'auto' }}>
      {items.map((item) => (
        <SidebarNavItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          active={activeItem === item.id}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </nav>
  );
}
