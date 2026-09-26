// Shadow Army — Third Hand v2 print plate
// Constraint: complete print plate <= 150 x 150 mm.
$fn=64;
base_x=70; base_y=70; base_h=6;
post_d=18; post_h=70;
arm_len=55; arm_w=14; arm_h=10;
pivot_d=5.3;       // M5 printable clearance
mount_d=4.5;       // M4 printable clearance
jaw_len=36; jaw_w=16; jaw_h=10;

module base(){
 difference(){
  union(){ cube([base_x,base_y,base_h]); translate([base_x/2,base_y/2,base_h]) cylinder(d=30,h=8); }
  for(x=[8,base_x-8]) for(y=[8,base_y-8]) translate([x,y,-1]) cylinder(d=mount_d,h=base_h+2);
  translate([base_x/2,base_y/2,-1]) cylinder(d=post_d+0.6,h=base_h+10);
 }
}
module post(){ difference(){ cylinder(d=post_d,h=post_h); translate([0,0,post_h-12]) rotate([0,90,0]) cylinder(d=pivot_d,h=post_d+4,center=true); } }
module arm(){ difference(){ hull(){ cylinder(d=arm_w,h=arm_h); translate([arm_len,0,0]) cylinder(d=arm_w,h=arm_h); } translate([0,0,-1]) cylinder(d=pivot_d,h=arm_h+2); translate([arm_len,0,-1]) cylinder(d=pivot_d,h=arm_h+2); } }
module jaw(){ difference(){ cube([jaw_len,jaw_w,jaw_h]); translate([11,-1,4]) cube([jaw_len-11,jaw_w+2,jaw_h+2]); translate([6,jaw_w/2,-1]) cylinder(d=pivot_d,h=jaw_h+2); } }

// Six deliberately isolated printable solids; >=4 mm XY gap between bounding boxes.
// 1 base: x0..70 y0..70
base();
// 2 post, horizontal: x80..98 y0..70
translate([98,0,9]) rotate([-90,0,0]) post();
// 3 arm1: x7..76 y82..96
translate([14,89,0]) arm();
// 4 arm2: x7..76 y104..118
translate([14,111,0]) arm();
// 5 jaw1: x92..128 y82..98
translate([92,82,0]) jaw();
// 6 jaw2: x92..128 y106..122
translate([92,106,0]) jaw();
