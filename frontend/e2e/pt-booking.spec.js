import { test, expect } from "@playwright/test";
test("customer books PT using its duration and sees it in the schedule on mobile", async ({ page }) => {
 const purchase={id:"purchase-1",package_name_snapshot:"PT 10 buổi",priceVnd:"2000000",status:"active",remainingSessions:10,usedSessions:0,session_count_snapshot:10,session_minutes_snapshot:60,cancellation_hours_snapshot:5,coach_user_id:"coach-1",expires_at:"2099-12-31T00:00:00Z",appointments:[]};
 const session={user:{id:"pt-member",role:"member",displayName:"Học viên PT",mustChangePassword:false,profileSetupRequired:false},permissions:["pt.read","pt.purchase","training.self.read","payment.self.read"]};
 await page.route("**/api/v1/**",async(route)=>{
  const path=new URL(route.request().url()).pathname;
  let data=[];
  if(path.endsWith("/auth/me"))data=session;
  else if(path.endsWith("/pt-purchases"))data=[purchase];
  else if(path.endsWith("/pt-resources"))data={rooms:[{id:"room-1",name:"Phòng PT"}],coaches:[{id:"coach-1",display_name:"Coach Bình"}]};
  else if(path.endsWith("/appointments")){
   expect(route.request().postDataJSON()).toEqual({roomId:"room-1",startsAt:"2099-04-01T01:00:00.000Z"});
   purchase.remainingSessions=9;
   purchase.appointments=[{id:"apt-1",status:"scheduled",session:{starts_at:"2099-04-01T01:00:00Z"}}];
   data=purchase.appointments[0];
  }
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({success:true,data})});
 });
 await page.goto("/pt");
 await expect(page.getByRole("heading",{name:"Huấn luyện cá nhân"})).toBeVisible();
 await page.getByRole("combobox",{name:"Phòng",exact:true}).selectOption("room-1");
 await page.getByLabel("Bắt đầu (giờ Việt Nam)").fill("2099-04-01T08:00");
 await page.getByRole("button",{name:"Đặt một buổi PT"}).click();
 await expect(page.getByRole("region",{name:"Gói PT trong phạm vi"})).toContainText("chưa dùng/chưa đặt: 9/10");
 await expect(page.getByRole("button",{name:"Ghi hoàn thành"})).toHaveCount(0);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.reload();
 await expect(page.getByRole("region",{name:"Gói PT trong phạm vi"})).toContainText("Đã đặt");
});
