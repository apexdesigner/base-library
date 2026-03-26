import { Directive, directive, property, method } from '@apexdesigner/dsl/directive';
import { MatDialog } from '@angular/material/dialog';
import { EventEmitter } from '@angular/core';
import { ConfirmationDialogComponent } from '@components';

/**
 * Confirm
 *
 * Attribute directive that intercepts click events and shows a confirmation
 * dialog before allowing the action to proceed. Applied to delete buttons
 * and other destructive operations.
 */
@directive({ selector: '[confirm][confirmMessage]' })
export class ConfirmDirective extends Directive {
  /** Confirm Message - The message displayed in the confirmation dialog */
  @property({ isInput: true })
  confirmMessage!: string;

  /** Confirm - Emitted when the user clicks Confirm */
  @property({ isOutput: true })
  confirm!: EventEmitter<void>;

  /** Mat Dialog */
  matDialog!: MatDialog;

  /** On Click - Intercept click and show confirmation dialog */
  @method({ callOnEvent: 'click' })
  async onClick(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const dialogRef = this.matDialog.open(ConfirmationDialogComponent.contentComponent);
    const instance: any = dialogRef.componentInstance;
    instance.message = this.confirmMessage;

    instance.confirmed.subscribe(() => {
      dialogRef.close();
      this.confirm.emit();
    });

    instance.canceled.subscribe(() => {
      dialogRef.close();
    });
  }
}
