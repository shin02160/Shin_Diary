import {
 Archive, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BookHeart, BookOpen, Bookmark,
 BriefcaseBusiness, Compass, LayoutGrid, List, Menu, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleCheck,
 CirclePause, CirclePlay, CloudDownload, CloudUpload, Coffee, Download, Eye, EyeOff, FileText,
 Filter, Heart, House, ImagePlus, Inbox, Link2, LockKeyhole, LogIn, LogOut, MapPin, Music2,
 Pencil, Plane, Plus, RotateCcw, Search, SlidersHorizontal, Star, Square, SquareCheck, Upload, UserRound,
} from 'lucide-react';
import type { Category, LifecycleStatus } from '@/lib/types';

const icons = {
 home: House, memories: BookHeart, wiki: BookOpen, calendar: CalendarDays, collection: Bookmark, favorite: Star,
 resume: CirclePlay, search: Search, settings: SlidersHorizontal, explore: Compass, menu: Menu, grid: LayoutGrid, list: List,
 travel: Plane, concert: Music2, project: BriefcaseBusiness, daily: Coffee,
 interested: Heart, active: CirclePlay, parked: CirclePause, satisfied: CircleCheck,
 back: ArrowLeft, forward: ArrowRight, open: ArrowUpRight, previous: ChevronLeft, next: ChevronRight,
 more: ChevronDown, add: Plus, edit: Pencil, place: MapPin, external: ArrowUpRight, link: Link2,
 archive: Archive, empty: Inbox, alert: CircleAlert, file: FileText, filter: Filter,
 download: Download, backup: ArrowDownToLine, upload: Upload, restore: RotateCcw,
 cloudRead: CloudDownload, cloudWrite: CloudUpload, login: LogIn, logout: LogOut,
 lock: LockKeyhole, show: Eye, hide: EyeOff, photo: ImagePlus, profile: UserRound,
 checked: SquareCheck, unchecked: Square,
};

export type IconName = keyof typeof icons;
export const categoryIcons = {
 Travel: 'travel', Concert: 'concert', Projects: 'project', Daily: 'daily',
} satisfies Record<Category, IconName>;
export const statusIcons = {
 interested: 'interested', active: 'active', parked: 'parked', satisfied: 'satisfied',
} satisfies Record<LifecycleStatus, IconName>;

export function Icon({ name, size = 'default' }: {
 name: IconName;
 size?: 'small' | 'default' | 'large' | 'hero';
}) {
 const Glyph = icons[name];
 return <Glyph className={'ui-icon ui-icon-' + size} strokeWidth={1.75} aria-hidden="true" focusable="false"/>;
}
