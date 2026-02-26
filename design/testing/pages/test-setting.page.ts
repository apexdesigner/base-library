import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { TestSettingFormGroup } from "@business-objects-client";
import { TestSettingsPage } from "@pages";

@page({
  path: "/test-settings/:testSetting.id",
  parentPage: TestSettingsPage,
})
export class TestSettingPage extends Page {

  @property({ read: "Automatically", save: "Automatically" })
  testSetting!: TestSettingFormGroup;
}

applyTemplate(TestSettingPage, `
  <if condition="!testSetting.reading">
    <flex-column>
      <h1>{{testSetting.value.name}}</h1>
      <sf-fields [group]="testSetting"></sf-fields>
    </flex-column>
    <else>
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    </else>
  </if>
`);
