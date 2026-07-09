// Card types for ConstrudaDataMax UI
import type { HTMLAttributes, forwardRef } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export interface CardCompoundProps {
  Root: React.FC<CardProps>
  Header: React.FC<CardHeaderProps>
  Title: React.FC<CardTitleProps>
  Description: React.FC<CardDescriptionProps>
  Content: React.FC<CardContentProps>
  Footer: React.FC<CardFooterProps>
}
