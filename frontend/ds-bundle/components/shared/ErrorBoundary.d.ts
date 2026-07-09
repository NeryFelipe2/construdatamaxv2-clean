// ErrorBoundary types for ConstrudaDataMax UI
import type { Component, ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children: ReactNode
}

export interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {}
