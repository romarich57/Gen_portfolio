import { useRef, useState } from 'react';

export type ProfileTab = 'INFO' | 'CONNECTIONS' | 'SECURITY' | 'DATA' | 'NOTIFICATIONS' | 'PLAN' | 'HISTORY';

export function useProfileUiState() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('INFO');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return {
    activeTab,
    setActiveTab,
    avatarInputRef,
    showSetPasswordModal,
    setShowSetPasswordModal,
    showChangePasswordModal,
    setShowChangePasswordModal,
    showChangeEmailModal,
    setShowChangeEmailModal,
    showBackupCodesModal,
    setShowBackupCodesModal,
    showDeleteModal,
    setShowDeleteModal
  };
}
