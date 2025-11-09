import React from 'react';
import {
  LayoutGrid,
  FileText,
  FolderKanban,
  CalendarDays,
  User,
  LogOut,
  Plus,
  Trash2,
  Users,
  CalendarCheck,
  Loader2,
  Check,
  FileDown,
  Sun,
  Moon,
  Menu,
  ChevronLeft,
  Clock,
  ShieldCheck,
  Bell,
  WifiOff,
  Sparkles,
  Mic,
  Camera,
  Ambulance,
  BarChart3,
  Megaphone,
  Settings,
  ChevronRight,
  HelpCircle,
  ShieldAlert,
  Pencil,
  Eraser,
  QrCode,
  BookMarked,
  Box,
  Tablet,
  Heart,
  Copy,
  RefreshCcw,
} from 'lucide-react';

// Type helper to pass through all props, including className
type IconProps = React.HTMLAttributes<SVGElement> & { className?: string };

// Re-exporting Lucide icons with the same names as your original components
// This ensures no breaking changes in your other components.

export const DashboardIcon: React.FC<IconProps> = (props) => (
  <LayoutGrid {...props} />
);

export const EprfIcon: React.FC<IconProps> = (props) => (
  <FileText {...props} />
);

export const DocsIcon: React.FC<IconProps> = (props) => (
  <FolderKanban {...props} />
);

export const RotaIcon: React.FC<IconProps> = (props) => (
  <CalendarDays {...props} />
);

export const ProfileIcon: React.FC<IconProps> = (props) => (
  <User {...props} />
);

export const LogoutIcon: React.FC<IconProps> = (props) => (
  <LogOut {...props} />
);

export const PlusIcon: React.FC<IconProps> = (props) => (
  <Plus {...props} />
);

export const TrashIcon: React.FC<IconProps> = (props) => (
  <Trash2 {...props} />
);

export const PatientsIcon: React.FC<IconProps> = (props) => (
  <Users {...props} />
);

export const EventsIcon: React.FC<IconProps> = (props) => (
  <CalendarCheck {...props} />
);

export const SpinnerIcon: React.FC<IconProps> = (props) => (
  // We add animate-spin here to match the original component's behavior
  <Loader2 {...props} className={`animate-spin ${props.className || ''}`} />
);

export const CheckIcon: React.FC<IconProps> = (props) => (
  <Check {...props} />
);

export const PdfIcon: React.FC<IconProps> = (props) => (
  <FileDown {...props} />
);

export const SunIcon: React.FC<IconProps> = (props) => (
  <Sun {...props} />
);

export const MoonIcon: React.FC<IconProps> = (props) => (
  <Moon {...props} />
);

export const MenuIcon: React.FC<IconProps> = (props) => (
  <Menu {...props} />
);

export const BackIcon: React.FC<IconProps> = (props) => (
  <ChevronLeft {...props} />
);

export const TimelineIcon: React.FC<IconProps> = (props) => (
  <Clock {...props} />
);

export const FormIcon: React.FC<IconProps> = (props) => (
  <FileText {...props} />
);

export const QualityIcon: React.FC<IconProps> = (props) => (
  <ShieldCheck {...props} />
);

export const BellIcon: React.FC<IconProps> = (props) => (
  <Bell {...props} />
);

export const WifiOfflineIcon: React.FC<IconProps> = (props) => (
  <WifiOff {...props} />
);

export const SparklesIcon: React.FC<IconProps> = (props) => (
  <Sparkles {...props} />
);

export const MicrophoneIcon: React.FC<IconProps> = (props) => (
  <Mic {...props} />
);

export const CameraIcon: React.FC<IconProps> = (props) => (
  <Camera {...props} />
);

export const AmbulanceIcon: React.FC<IconProps> = (props) => (
  <Ambulance {...props} />
);

export const ChartIcon: React.FC<IconProps> = (props) => (
  <BarChart3 {...props} />
);

export const MegaphoneIcon: React.FC<IconProps> = (props) => (
  <Megaphone {...props} />
);

export const AdminIcon: React.FC<IconProps> = (props) => (
  <Settings {...props} />
);

export const ClockIcon: React.FC<IconProps> = (props) => (
  <Clock {...props} />
);

export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
  <ChevronLeft {...props} />
);

export const ChevronRightIcon: React.FC<IconProps> = (props) => (
  <ChevronRight {...props} />
);

export const QuestionMarkCircleIcon: React.FC<IconProps> = (props) => (
  <HelpCircle {...props} />
);

export const ShieldExclamationIcon: React.FC<IconProps> = (props) => (
  <ShieldAlert {...props} />
);

export const PencilIcon: React.FC<IconProps> = (props) => (
  <Pencil {...props} />
);

export const EraserIcon: React.FC<IconProps> = (props) => (
  <Eraser {...props} />
);

export const QrCodeIcon: React.FC<IconProps> = (props) => (
  <QrCode {...props} />
);

export const CPDIcon: React.FC<IconProps> = (props) => (
  <BookMarked {...props} />
);

export const BoxIcon: React.FC<IconProps> = (props) => (
  <Box {...props} />
);

export const PillIcon: React.FC<IconProps> = (props) => (
  <Tablet {...props} />
);

export const HeartIcon: React.FC<IconProps> = (props) => (
  <Heart {...props} />
);

export const CopyIcon: React.FC<IconProps> = (props) => (
  <Copy {...props} />
);

export const RefreshIcon: React.FC<IconProps> = (props) => (
  <RefreshCcw {...props} />
);
